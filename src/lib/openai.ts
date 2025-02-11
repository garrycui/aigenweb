import OpenAI from 'openai';
import { db } from './firebase';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

// Save chat message to Firestore
export const saveChatMessage = async (userId: string, message: string, role: 'user' | 'assistant', sentiment?: string) => {
  try {
    const chatRef = doc(db, 'chatHistory', userId);
    await updateDoc(chatRef, {
      messages: arrayUnion({
        content: message,
        role,
        sentiment,
        timestamp: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('Error saving chat message:', error);
    throw error;
  }
};

// Get chat history
export const getChatHistory = async (userId: string) => {
  try {
    const chatRef = doc(db, 'chatHistory', userId);
    const snapshot = await getDoc(chatRef);
    const chatData = snapshot.data();
    return chatData?.messages || [];
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return [];
  }
};

// Get resource recommendations based on user context and message
export const getResourceRecommendations = async (
  userId: string,
  message: string,
  mbtiType?: string,
  aiPreference?: string
) => {
  try {
    // Get relevant forum posts
    const postsRef = collection(db, 'posts');
    const postsQuery = query(
      postsRef,
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    
    const postsSnapshot = await getDocs(postsQuery);
    const posts = postsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || '',
        content: data.content || ''
      };
    });

    // Use ChatGPT to find relevant posts
    const prompt = `Given the user message: "${message}", and their MBTI type: ${mbtiType || 'unknown'} and AI preference: ${aiPreference || 'unknown'}, analyze these posts and return the IDs of the 3 most relevant ones. Posts: ${JSON.stringify(posts.map(p => ({ id: p.id, title: p.title, content: p.content })))}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a recommendation system. Respond only with a JSON array of post IDs.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const relevantPostIds = JSON.parse(completion.choices[0].message?.content || '[]');
    const relevantPosts = posts.filter(post => relevantPostIds.includes(post.id));

    return {
      posts: relevantPosts.map(post => ({
        id: post.id,
        title: post.title,
        content: post.content,
        type: 'post'
      }))
    };
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return { posts: [] };
  }
};

// Generate chat response
export const generateChatResponse = async (
  message: string,
  userId: string,
  chatHistory: Array<{ content: string; role: 'user' | 'assistant'; sentiment?: string; timestamp: string; }>,
  mbtiType?: string,
  aiPreference?: string
) => {
  try {
    const historyContext = chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n');
    const prompt = `You are a helpful AI assistant guiding users through AI adaptation. The user has MBTI type: ${mbtiType || 'unknown'} and AI preference: ${aiPreference || 'unknown'}. Tailor your response accordingly. Here is the chat history:\n${historyContext}\nUser: ${message}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant. Respond to the user based on the provided context.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const response = completion.choices[0].message?.content || 'I apologize, but I could not generate a response.';
    return { response };
  } catch (error) {
    console.error('Error generating chat response:', error);
    throw error;
  }
};