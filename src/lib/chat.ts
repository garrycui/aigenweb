import vader from 'vader-sentiment';
import { collection, doc, getDoc, setDoc, updateDoc, arrayUnion, query, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getLatestAssessment } from './api';
import { generateChatResponse, getResourceRecommendations } from './openai';

interface ChatMessage {
  content: string;
  role: 'user' | 'assistant';
  sentiment?: 'positive' | 'negative' | 'neutral';
  timestamp: string;
}

// Initialize chat document for user if it doesn't exist
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

// Analyze sentiment of a message
const analyzeSentiment = (message: string): 'positive' | 'negative' | 'neutral' => {
  const intensity = vader.SentimentIntensityAnalyzer.polarity_scores(message);
  
  // Determine overall sentiment
  if (intensity.compound >= 0.05) return 'positive';
  if (intensity.compound <= -0.05) return 'negative';
  return 'neutral';
};

// Save chat message with sentiment analysis
export const saveChatMessage = async (userId: string, message: string, role: 'user' | 'assistant') => {
  try {
    if (!userId || !message || !role) {
      throw new Error('Missing required fields for chat message');
    }

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
  } catch (error) {
    console.error('Error saving chat message:', error);
    throw error;
  }
};

// Get chat history
export const getChatHistory = async (userId: string): Promise<ChatMessage[]> => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const chatRef = doc(db, 'chatHistory', userId);
    const chatDoc = await getDoc(chatRef);
    
    if (!chatDoc.exists()) {
      return [];
    }

    const data = chatDoc.data();
    return data.messages || [];
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return [];
  }
};

// Process chat message with context
export const processChatMessage = async (userId: string, message: string) => {
  try {
    if (!userId || !message) {
      throw new Error('User ID and message are required');
    }

    // Get user's assessment results
    const { data: assessment } = await getLatestAssessment(userId);
    const mbtiType = assessment?.mbti_type;
    const aiPreference = assessment?.ai_preference;

    // Get chat history
    const chatHistory = await getChatHistory(userId);

    // Save user message with sentiment
    const { sentiment } = await saveChatMessage(userId, message, 'user');

    // Generate response considering user context and chat history
    const response = await generateChatResponse(message, userId, chatHistory, mbtiType, aiPreference);

    if (!response || !response.response) {
      throw new Error('Failed to generate chat response');
    }

    // Save assistant response
    await saveChatMessage(userId, response.response, 'assistant');

    // Check if the user is asking for recommendations or learning resources
    let recommendations: { id: string; title: string; content: string; link: string }[] = [];
    const recommendationKeywords = ['recommend', 'suggest', 'advise', 'help me find', 'looking for', 'learn', 'more about'];
    const isAskingForRecommendation = recommendationKeywords.some(keyword => message.toLowerCase().includes(keyword));

    if (isAskingForRecommendation) {
      const recommendationResult = await getResourceRecommendations(userId, message, mbtiType, aiPreference);
      recommendations = recommendationResult.posts.map(post => ({
        id: post.id,
        title: post.title,
        content: post.content,
        link: `/posts/${post.id}`
      }));
    }

    return {
      response: response.response,
      sentiment,
      userContext: {
        mbtiType,
        aiPreference
      },
      recommendations
    };
  } catch (error) {
    console.error('Error processing chat message:', error);
    throw error;
  }
};