import OpenAI from 'openai';
import { db } from './firebase';
import { collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp, doc, updateDoc, arrayUnion } from 'firebase/firestore';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

// Save chat message to Firestore
export const saveChatMessage = async (userId: string, message: string, role: 'user' | 'assistant', sentiment?: string) => {
  try {
    const chatRef = doc(collection(db, 'chatHistory'), userId);
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
    const chatRef = doc(collection(db, 'chatHistory'), userId);
    const snapshot = await getDocs(query(collection(chatRef, 'messages'), orderBy('timestamp', 'desc'), limit(10)));
    return snapshot.docs.map(doc => doc.data());
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
    const posts = postsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

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
  mbtiType?: string,
  aiPreference?: string
) => {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a helpful AI assistant guiding users through AI adaptation. The user has MBTI type: ${mbtiType || 'unknown'} and AI preference: ${aiPreference || 'unknown'}. Tailor your response accordingly.`
        },
        {
          role: 'user',
          content: message
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