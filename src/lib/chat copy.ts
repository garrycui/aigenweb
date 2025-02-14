import vader from 'vader-sentiment';
import Fuse from 'fuse.js';
import { collection, doc, getDoc, setDoc, updateDoc, arrayUnion, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getLatestAssessment } from './api';
import { generateChatResponse } from './openai';

interface ChatMessage {
  content: string;
  role: 'user' | 'assistant';
  sentiment?: 'positive' | 'negative' | 'neutral';
  timestamp: string;
}

let cachedPosts: { id: string; title: string; content: string }[] | null = null;
let cachedTutorials: { id: string; title: string; content: string }[] | null = null;
let fuse: Fuse<{ id: string; title: string; content: string }> | null = null;

/**
 * Initialize a chat document for a user if it doesn't exist.
 */
const initializeChatDoc = async (userId: string) => {
  const chatRef = doc(db, 'chatHistory', userId);
  const chatDoc = await getDoc(chatRef);

  if (!chatDoc.exists()) {
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
 * Analyze the sentiment of a message using vader-sentiment.
 */
const analyzeSentiment = (message: string): 'positive' | 'negative' | 'neutral' => {
  const intensity = vader.SentimentIntensityAnalyzer.polarity_scores(message);
  if (intensity.compound >= 0.05) return 'positive';
  if (intensity.compound <= -0.05) return 'negative';
  return 'neutral';
};

/**
 * Save a chat message to Firestore with sentiment analysis for user messages.
 */
export const saveChatMessage = async (userId: string, message: string, role: 'user' | 'assistant') => {
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

  return { sentiment: messageData.sentiment };
};

/**
 * Retrieve chat history for a user.
 */
export const getChatHistory = async (userId: string): Promise<ChatMessage[]> => {
  if (!userId) throw new Error('User ID is required');
  const chatRef = doc(db, 'chatHistory', userId);
  const chatDoc = await getDoc(chatRef);
  return chatDoc.exists() ? (chatDoc.data().messages || []) : [];
};

/**
 * Fetch combined content from both 'posts' and 'tutorials' using Fuse.js.
 * Assumes each document has a 'title' and 'content'.
 */
async function fetchCombinedContent(searchPhrase: string): Promise<{ id: string; title: string }[]> {
  // If caches are not populated, fetch from Firestore.
  if (!cachedPosts || !cachedTutorials) {
    const postsRef = collection(db, 'posts');
    const postsSnap = await getDocs(postsRef);
    cachedPosts = postsSnap.docs.map(doc => ({
      id: doc.id,
      title: (doc.data().title || '').toString(),
      content: (doc.data().content || '').toString()
    }));

    const tutorialsRef = collection(db, 'tutorials');
    const tutorialsSnap = await getDocs(tutorialsRef);
    cachedTutorials = tutorialsSnap.docs.map(doc => ({
      id: doc.id,
      title: (doc.data().title || '').toString(),
      content: (doc.data().content || '').toString()
    }));

    fuse = new Fuse([...cachedPosts, ...cachedTutorials], {
      keys: ['title', 'content'],
      threshold: 0.3
    });
  }

  // Ensure fuse is initialized.
  if (!fuse) {
    fuse = new Fuse([...cachedPosts, ...cachedTutorials], {
      keys: ['title', 'content'],
      threshold: 0.3
    });
  }

  // Search and return top 3 matches.
  return fuse.search(searchPhrase).slice(0, 3).map(result => result.item);
}

/**
 * Determine if the user's message indicates a learning intent.
 * Returns "learning" if keywords like "tutorial", "guide", or "learn" are present, otherwise "other".
 */
const determineLearningIntent = async (message: string): Promise<"learning" | "other"> => {
  const lower = message.toLowerCase();
  const learningKeywords = ['tutorial', 'guide', 'learn', 'explain', 'how to', 'show me'];
  return learningKeywords.some(keyword => lower.includes(keyword)) ? "learning" : "other";
};

/**
 * Rewrite the user's query for a more effective Firestore search.
 * This function removes common stop phrases to yield a concise search term.
 */
const rewriteQueryForSearch = async (message: string): Promise<string> => {
  let query = message.toLowerCase();
  // Remove stop phrases that do not aid the search.
  const stopPhrases = ['i need', 'please', 'show me', 'how to', 'explain'];
  stopPhrases.forEach(phrase => {
    query = query.replace(phrase, '');
  });
  return query.trim();
};

/**
 * Process the user's chat message.
 * If learning intent is detected, fetch 3 recommended content items (tutorials/posts)
 * and generate a recommendation response. Otherwise, proceed with normal chat.
 */
export const processChatMessage = async (userId: string, message: string) => {
  try {
    if (!userId || !message) throw new Error('User ID and message are required');

    // Retrieve user context.
    const { data: assessment } = await getLatestAssessment(userId);
    const mbtiType = assessment?.mbti_type;
    const aiPreference = assessment?.ai_preference;
    const chatHistory = await getChatHistory(userId);

    // Save the user's message.
    const { sentiment } = await saveChatMessage(userId, message, 'user');

    // Determine if the message has a learning intent.
    const intent = await determineLearningIntent(message);
    if (intent === 'learning') {
      const searchPhrase = await rewriteQueryForSearch(message);
      const contentItems = await fetchCombinedContent(searchPhrase);
      if (contentItems.length) {
        // Format the recommended items without links.
        const recommendationText = contentItems
          .map(item => `• ${item.title}`)
          .join('\n');
        
        // Generate a recommendation response using GPT-4.
        const learningResponse = await generateChatResponse(
          recommendationText,
          userId,
          chatHistory,
          mbtiType,
          aiPreference
        );
        await saveChatMessage(userId, learningResponse.response, 'assistant');
        return {
          response: learningResponse.response,
          sentiment,
          userContext: { mbtiType, aiPreference },
          recommendations: contentItems
        };
      }
    }

    // If no learning intent, generate a normal chat response.
    const response = await generateChatResponse(message, userId, chatHistory, mbtiType, aiPreference);
    if (!response || !response.response) throw new Error('Failed to generate chat response');
    await saveChatMessage(userId, response.response, 'assistant');
    return {
      response: response.response,
      sentiment,
      userContext: { mbtiType, aiPreference },
      recommendations: []
    };
  } catch (error) {
    console.error('Error processing chat message:', error);
    throw error;
  }
};
