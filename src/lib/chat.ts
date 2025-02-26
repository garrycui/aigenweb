import vader from 'vader-sentiment';
import Fuse from 'fuse.js';
import { 
  collection, doc, getDoc, setDoc, updateDoc, arrayUnion, 
  getDocs, serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { getLatestAssessment } from './api';
import { generateChatResponse, extractKeyword} from './openai';

interface ChatMessage {
  content: string;
  role: 'user' | 'assistant';
  sentiment?: 'positive' | 'negative' | 'neutral';
  timestamp: string;
}

let cachedPosts: { id: string; title: string; content: string }[] | null = null;
let cachedTutorials: { id: string; title: string; content: string }[] | null = null;
let lastCacheUpdate: number | null = null;
let fuse: Fuse<{ id: string; title: string; content: string }> | null = null;

const CACHE_EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Initialize chat history for a user in Firestore.
 */
const initializeChatDoc = async (userId: string) => {
  console.log('Initializing chat document for user:', userId);
  const chatRef = doc(db, 'chatHistory', userId);
  const chatDoc = await getDoc(chatRef);

  if (!chatDoc.exists()) {
    console.log('Chat document does not exist, creating new document.');
    await setDoc(chatRef, {
      userId,
      messages: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
  return chatRef;
};

/**
 * Analyze sentiment of a message using vader-sentiment.
 */
const analyzeSentiment = (message: string): 'positive' | 'negative' | 'neutral' => {
  console.log('Analyzing sentiment for message:', message);
  if (!message) return 'neutral';
  const intensity = vader.SentimentIntensityAnalyzer.polarity_scores(message);
  console.log('Sentiment intensity:', intensity);
  if (intensity?.compound >= 0.05) return 'positive';
  if (intensity?.compound <= -0.05) return 'negative';
  return 'neutral';
};

/**
 * Save chat messages to Firestore.
 */
export const saveChatMessage = async (userId: string, message: string, role: 'user' | 'assistant') => {
  console.log('Saving chat message:', { userId, message, role });
  if (!userId || !message || !role) throw new Error('Missing required fields for chat message');
  const chatRef = await initializeChatDoc(userId);

  const messageData: ChatMessage = {
    content: message,
    role,
    timestamp: new Date().toISOString()
  };

  if (role === 'user') {
    messageData.sentiment = analyzeSentiment(message);
  }

  await updateDoc(chatRef, {
    messages: arrayUnion(messageData),
    updatedAt: serverTimestamp()
  });

  console.log('Chat message saved:', messageData);
  return { sentiment: messageData.sentiment };
};

/**
 * Retrieve paginated chat history from Firestore.
 */
export const getChatHistory = async (
  userId: string, 
  limit: number = 20, 
  startAfter?: string
): Promise<ChatMessage[]> => {
  console.log('Retrieving chat history for user:', userId);
  if (!userId) throw new Error('User ID is required');
  
  const chatRef = doc(db, 'chatHistory', userId);
  const chatDoc = await getDoc(chatRef);
  
  if (!chatDoc.exists()) return [];
  
  const allMessages = chatDoc.data().messages || [];
  
  // Sort messages by timestamp (newest first)
  const sortedMessages = [...allMessages].sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  
  // Apply pagination if needed
  let paginatedMessages = sortedMessages;
  if (startAfter) {
    const startIndex = sortedMessages.findIndex(msg => msg.timestamp === startAfter);
    if (startIndex !== -1) {
      paginatedMessages = sortedMessages.slice(startIndex + 1, startIndex + 1 + limit);
    }
  } else {
    paginatedMessages = sortedMessages.slice(0, limit);
  }
  
  // Return messages in chronological order
  return paginatedMessages.reverse();
};

/**
 * Fetch cached tutorials and posts from Firestore with Fuse.js search.
 */
// Update return type to include content type
async function fetchCombinedContent(searchPhrase: string): Promise<Array<{ 
  id: string; 
  title: string; 
  content: string;
  type: 'post' | 'tutorial';
}>>{
  console.log('Fetching combined content for search phrase:', searchPhrase);
  const now = Date.now();
  
  // Refresh cache every 24 hours
  if (!cachedPosts || !cachedTutorials || !lastCacheUpdate || now - lastCacheUpdate > CACHE_EXPIRATION_TIME) {
    console.log("Refreshing Firestore cache...");
    const postsRef = collection(db, 'posts');
    const tutorialsRef = collection(db, 'tutorials');

    const [postsSnap, tutorialsSnap] = await Promise.all([getDocs(postsRef), getDocs(tutorialsRef)]);
    
    cachedPosts = postsSnap.docs.map(doc => ({
      id: doc.id,
      title: doc.data().title.toString(),
      content: doc.data().content.toString()
    }));

    cachedTutorials = tutorialsSnap.docs.map(doc => ({
      id: doc.id,
      title: doc.data().title.toString(),
      content: doc.data().content.toString()
    }));

    // Include both types in search but maintain separate caches
    fuse = new Fuse(
      [...cachedPosts.map(post => ({...post, type: 'post'})), 
       ...cachedTutorials.map(tutorial => ({...tutorial, type: 'tutorial'}))], 
      {
        keys: ['title'],
        threshold: 0.5
      }
    );

    lastCacheUpdate = now;
    console.log('Cache updated.');
  }

  if (!fuse) {
    fuse = new Fuse(
      [...cachedPosts.map(post => ({...post, type: 'post'})), 
       ...cachedTutorials.map(tutorial => ({...tutorial, type: 'tutorial'}))], 
      {
        keys: ['title'],
        threshold: 0.5
      }
    );
  }

  const results = fuse.search(searchPhrase).slice(0, 3).map(result => result.item as { 
    id: string; 
    title: string; 
    content: string;
    type: 'post' | 'tutorial';
  });
  console.log('Search results:', results);
  return results;
}

/**
 * Determine if a message has a learning intent or could benefit from resources.
 */
const determineLearningIntent = async (message: string, chatHistory: ChatMessage[] = []): Promise<"learning" | "other"> => {
  console.log('Determining learning intent for message:', message);
  
  // Get last few messages to establish context, could add to the lower context
  const recentMessages = chatHistory.slice(-5);
  const conversationContext = recentMessages.map(msg => msg.content).join(' ');
  
  const lower = message.toLowerCase();
  
  // Expanded keywords for learning intent
  const learningKeywords = [
    'tutorial', 'guide', 'learn', 'explain', 'how to', 'show me',
    'understand', 'resource', 'teach', 'help me with', 'example',
    'struggle with', 'difficulty', 'confused about', 'more information',
    'guidance', 'advice', 'best practice', 'recommend', 'suggestion'
  ];
  
  // Check if current message contains learning keywords
  const messageHasIntent = learningKeywords.some(keyword => lower.includes(keyword));
  
  // Check if the conversation context suggests a learning opportunity
  const contextHasLearningClues = 
    lower.includes('improve') || 
    lower.includes('better') || 
    lower.includes('want to') ||
    lower.includes('help me') ||
    lower.includes('not sure how');
    
  const intent = (messageHasIntent || contextHasLearningClues) ? "learning" : "other";
  console.log('Learning intent:', intent);
  return intent;
};

/**
 * Process a chat message.
 */
export const processChatMessage = async (userId: string, message: string) => {
  try {
    if (!userId || !message || typeof message !== 'string') {
      throw new Error('Invalid input: User ID and message are required');
    }

    console.log('Processing chat message:', message);

    const { data: assessment } = await getLatestAssessment(userId);
    const mbtiType = assessment?.mbti_type;
    const aiPreference = assessment?.ai_preference;
    const chatHistory = await getChatHistory(userId);

    console.log('User assessment:', { mbtiType, aiPreference });
    console.log('Chat history:', chatHistory);

    const { sentiment } = await saveChatMessage(userId, message, 'user');

    // Step 1: Generate AI response and send it
    const aiResponse = await generateChatResponse(message, chatHistory, mbtiType, aiPreference);
    if (!aiResponse || !aiResponse.response) throw new Error('Failed to generate chat response');

    console.log('AI response:', aiResponse.response);

    await saveChatMessage(userId, aiResponse.response, 'assistant');

    const firstResponse = {
      response: aiResponse.response,
      sentiment,
      userContext: { mbtiType, aiPreference },
      recommendations: []
    };

    // Check if the user has a learning intent (now with chat history)
    const intent = await determineLearningIntent(message, chatHistory);
    console.log('User intent:', intent);

    if (intent === 'learning') {
      // Step 2: Fetch recommendations (titles only) & send a second message
      const searchPhrase = await extractKeyword(message);
      console.log('Search phrase:', searchPhrase);

      const contentItems = await fetchCombinedContent(searchPhrase);
      console.log('Content items:', contentItems);

      if (contentItems.length) {
        const recommendationsText = `Here are some helpful resources:\n` +
          contentItems.map(item => `• ${item.title}`).join('\n');

        await saveChatMessage(userId, recommendationsText, 'assistant');

        return [firstResponse, {
          response: recommendationsText,
          sentiment,
          userContext: { mbtiType, aiPreference },
          recommendations: contentItems
        }];
      }

      return [firstResponse];
    }

    return firstResponse;

  } catch (error) {
    console.error('Error processing chat message:', error);
    throw error;
  }
};
