import vader from 'vader-sentiment';
import Fuse from 'fuse.js';
import { 
  collection, doc, getDoc, setDoc, updateDoc, arrayUnion, 
  getDocs, serverTimestamp, deleteDoc
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
 * Analyze sentiment of a message using vader-sentiment.
 */
const analyzeSentiment = (message: string): 'positive' | 'negative' | 'neutral' => {
  if (!message) return 'neutral';
  const intensity = vader.SentimentIntensityAnalyzer.polarity_scores(message);
  if (intensity?.compound >= 0.05) return 'positive';
  if (intensity?.compound <= -0.05) return 'negative';
  return 'neutral';
};

/**
 * Save chat messages to Firestore.
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
 * Retrieve paginated chat history from Firestore.
 */
export const getChatHistory = async (
  userId: string, 
  limit: number = 50, 
  startAfter?: string
): Promise<ChatMessage[]> => {
  // Ensure user has session structure
  await migrateToSessions(userId);
  
  // Get the current session
  const { currentSessionId } = await getUserSessions(userId);
  
  if (!currentSessionId) {
    return [];
  }
  
  // Get the messages for the current session
  return getSessionMessages(userId, currentSessionId);
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
  const now = Date.now();
  
  // Refresh cache every 24 hours
  if (!cachedPosts || !cachedTutorials || !lastCacheUpdate || now - lastCacheUpdate > CACHE_EXPIRATION_TIME) {
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
  return results;
}

/**
 * Determine if a message has a learning intent or could benefit from resources.
 */
const determineLearningIntent = async (message: string, chatHistory: ChatMessage[] = []): Promise<"learning" | "other"> => {
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
    
  return (messageHasIntent || contextHasLearningClues) ? "learning" : "other";
};

/**
 * Process a chat message.
 */
export const processChatMessage = async (userId: string, message: string) => {
  // Ensure user has session structure
  await migrateToSessions(userId);
  
  // Get the current session or create one
  const sessionId = await getOrCreateSession(userId);
  
  // Process with the session ID
  return processChatWithSession(userId, sessionId, message);
};

// New interfaces for session management
interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  lastActiveAt: string;
  messages: ChatMessage[];
}

interface ChatSessionsDoc {
  userId: string;
  activeSessions: ChatSession[];
  archivedSessions: ChatSession[];
  currentSessionId: string;
  createdAt: any; // Firestore timestamp
  updatedAt: any; // Firestore timestamp
}

// Constants for session management
const MAX_ACTIVE_SESSIONS = 5;
const SESSION_INACTIVITY_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Initialize sessions document for a user
 */
const initializeSessionsDoc = async (userId: string): Promise<string> => {
  const sessionsRef = doc(db, 'chatSessions', userId);
  const sessionsDoc = await getDoc(sessionsRef);

  if (!sessionsDoc.exists()) {
    // Create initial session
    const sessionId = `session_${Date.now()}`;
    const newSession: ChatSession = {
      id: sessionId,
      title: 'New Conversation',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      messages: []
    };

    await setDoc(sessionsRef, {
      userId,
      activeSessions: [newSession],
      archivedSessions: [],
      currentSessionId: sessionId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return sessionId;
  }

  return sessionsDoc.data().currentSessionId || '';
};

/**
 * Get or create a session
 */
export const getOrCreateSession = async (userId: string): Promise<string> => {
  if (!userId) throw new Error('User ID is required');
  
  // First, check if sessions doc exists
  const sessionsRef = doc(db, 'chatSessions', userId);
  const sessionsDoc = await getDoc(sessionsRef);
  
  if (!sessionsDoc.exists()) {
    // Initialize and return a new session ID
    return initializeSessionsDoc(userId);
  }
  
  // Get the data
  const data = sessionsDoc.data() as ChatSessionsDoc;
  
  // Check if there's an active current session
  if (data.currentSessionId) {
    const currentSession = data.activeSessions.find(s => s.id === data.currentSessionId);
    if (currentSession) {
      return data.currentSessionId;
    }
  }
  
  // If we don't have a valid current session, create a new one
  const sessionId = `session_${Date.now()}`;
  const newSession: ChatSession = {
    id: sessionId,
    title: 'New Conversation',
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    messages: []
  };
  
  const activeSessions = [newSession, ...(data.activeSessions || [])];
  
  await updateDoc(sessionsRef, {
    activeSessions,
    currentSessionId: sessionId,
    updatedAt: serverTimestamp()
  });
  
  return sessionId;
};

/**
 * Get user's sessions
 */
export const getUserSessions = async (userId: string): Promise<{
  activeSessions: ChatSession[];
  archivedSessions: ChatSession[];
  currentSessionId: string;
}> => {
  if (!userId) throw new Error('User ID is required');
  
  const sessionsRef = doc(db, 'chatSessions', userId);
  const sessionsDoc = await getDoc(sessionsRef);
  
  if (!sessionsDoc.exists()) {
    // Initialize first
    await initializeSessionsDoc(userId);
    return getUserSessions(userId);
  }
  
  const data = sessionsDoc.data() as ChatSessionsDoc;
  return {
    activeSessions: data.activeSessions || [],
    archivedSessions: data.archivedSessions || [],
    currentSessionId: data.currentSessionId
  };
};

/**
 * Set the current active session
 */
export const setCurrentSession = async (userId: string, sessionId: string): Promise<void> => {
  if (!userId || !sessionId) throw new Error('User ID and session ID are required');
  
  const sessionsRef = doc(db, 'chatSessions', userId);
  await updateDoc(sessionsRef, {
    currentSessionId: sessionId,
    updatedAt: serverTimestamp()
  });
};

/**
 * Create a new session and set it as current
 */
export const createNewSession = async (userId: string): Promise<string> => {
  if (!userId) throw new Error('User ID is required');
  
  const sessionsRef = doc(db, 'chatSessions', userId);
  const sessionsDoc = await getDoc(sessionsRef);
  
  if (!sessionsDoc.exists()) {
    return initializeSessionsDoc(userId);
  }
  
  const data = sessionsDoc.data() as ChatSessionsDoc;
  const sessionId = `session_${Date.now()}`;
  const newSession: ChatSession = {
    id: sessionId,
    title: 'New Conversation',
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    messages: []
  };
  
  // Add new session to beginning of active sessions
  let activeSessions = [newSession, ...(data.activeSessions || [])];
  
  // Manage active session limit
  if (activeSessions.length > MAX_ACTIVE_SESSIONS) {
    // Move oldest sessions to archived
    const sessionsToArchive = activeSessions.splice(MAX_ACTIVE_SESSIONS);
    const archivedSessions = [...sessionsToArchive, ...(data.archivedSessions || [])];
    
    await updateDoc(sessionsRef, {
      activeSessions,
      archivedSessions,
      currentSessionId: sessionId,
      updatedAt: serverTimestamp()
    });
  } else {
    await updateDoc(sessionsRef, {
      activeSessions,
      currentSessionId: sessionId,
      updatedAt: serverTimestamp()
    });
  }
  
  return sessionId;
};

/**
 * Add message to a specific session
 */
export const addMessageToSession = async (
  userId: string,
  sessionId: string,
  message: string,
  role: 'user' | 'assistant'
): Promise<{ sentiment?: 'positive' | 'negative' | 'neutral' }> => {
  if (!userId || !sessionId || !message || !role) {
    throw new Error('Missing required fields for adding message');
  }
  
  const sessionsRef = doc(db, 'chatSessions', userId);
  const sessionsDoc = await getDoc(sessionsRef);
  
  if (!sessionsDoc.exists()) {
    throw new Error('Chat sessions not found');
  }
  
  const data = sessionsDoc.data() as ChatSessionsDoc;
  const now = new Date().toISOString();
  
  // Create message data
  const messageData: ChatMessage = {
    content: message,
    role,
    timestamp: now
  };
  
  if (role === 'user') {
    messageData.sentiment = analyzeSentiment(message);
  }
  
  // Find the session to update
  let sessionFound = false;
  const activeSessions = [...data.activeSessions];
  
  // First check active sessions
  for (let i = 0; i < activeSessions.length; i++) {
    if (activeSessions[i].id === sessionId) {
      // Update the session
      activeSessions[i].messages.push(messageData);
      activeSessions[i].lastActiveAt = now;
      
      // Update session title based on first user message if needed
      if (activeSessions[i].title === 'New Conversation' && role === 'user') {
        // Use first few words of message as title
        const words = message.split(' ');
        const title = words.slice(0, 4).join(' ') + (words.length > 4 ? '...' : '');
        activeSessions[i].title = title;
      }
      
      sessionFound = true;
      break;
    }
  }
  
  if (!sessionFound) {
    // Check archived sessions
    const archivedSessions = [...data.archivedSessions];
    let sessionToActivate = null;
    
    for (let i = 0; i < archivedSessions.length; i++) {
      if (archivedSessions[i].id === sessionId) {
        // Found in archive, move to active
        sessionToActivate = archivedSessions.splice(i, 1)[0];
        sessionToActivate.messages.push(messageData);
        sessionToActivate.lastActiveAt = now;
        break;
      }
    }
    
    if (sessionToActivate) {
      // Add to beginning of active sessions
      activeSessions.unshift(sessionToActivate);
      
      // Manage active session limit
      if (activeSessions.length > MAX_ACTIVE_SESSIONS) {
        // Move oldest sessions to archived
        const sessionsToArchive = activeSessions.splice(MAX_ACTIVE_SESSIONS);
        const updatedArchived = [...sessionsToArchive, ...archivedSessions];
        
        await updateDoc(sessionsRef, {
          activeSessions,
          archivedSessions: updatedArchived,
          currentSessionId: sessionId,
          updatedAt: serverTimestamp()
        });
      } else {
        await updateDoc(sessionsRef, {
          activeSessions,
          archivedSessions,
          currentSessionId: sessionId,
          updatedAt: serverTimestamp()
        });
      }
      
      sessionFound = true;
    }
  }
  
  if (!sessionFound) {
    throw new Error('Session not found');
  } else {
    await updateDoc(sessionsRef, {
      activeSessions,
      updatedAt: serverTimestamp()
    });
  }
  
  return { sentiment: role === 'user' ? messageData.sentiment : undefined };
};

/**
 * Delete a session
 */
export const deleteSession = async (userId: string, sessionId: string): Promise<void> => {
  if (!userId || !sessionId) throw new Error('User ID and session ID are required');
  
  const sessionsRef = doc(db, 'chatSessions', userId);
  const sessionsDoc = await getDoc(sessionsRef);
  
  if (!sessionsDoc.exists()) return;
  
  const data = sessionsDoc.data() as ChatSessionsDoc;
  
  // Filter out the session to delete
  const activeSessions = data.activeSessions.filter(s => s.id !== sessionId);
  const archivedSessions = data.archivedSessions.filter(s => s.id !== sessionId);
  
  // If deleting the current session, set a new current session
  let currentSessionId = data.currentSessionId;
  if (currentSessionId === sessionId) {
    currentSessionId = activeSessions.length > 0 ? activeSessions[0].id : '';
  }
  
  await updateDoc(sessionsRef, {
    activeSessions,
    archivedSessions,
    currentSessionId,
    updatedAt: serverTimestamp()
  });
};

/**
 * Get messages for a specific session
 */
export const getSessionMessages = async (userId: string, sessionId: string): Promise<ChatMessage[]> => {
  if (!userId || !sessionId) throw new Error('User ID and session ID are required');
  
  const { activeSessions, archivedSessions } = await getUserSessions(userId);
  
  // Look for session in active sessions first
  let session = activeSessions.find(s => s.id === sessionId);
  
  if (!session) {
    // Try archived sessions
    session = archivedSessions.find(s => s.id === sessionId);
  }
  
  return session?.messages || [];
};

/**
 * Process chat message with sessions
 */
export const processChatWithSession = async (userId: string, sessionId: string, message: string) => {
  try {
    if (!userId || !sessionId || !message || typeof message !== 'string') {
      throw new Error('Invalid input for processing chat message');
    }

    const { data: assessment } = await getLatestAssessment(userId);
    const mbtiType = assessment?.mbti_type;
    const aiPreference = assessment?.ai_preference;
    
    // Get session messages for context
    const chatHistory = await getSessionMessages(userId, sessionId);

    // Save user message to session
    const { sentiment } = await addMessageToSession(userId, sessionId, message, 'user');

    // Generate AI response
    const aiResponse = await generateChatResponse(message, chatHistory, mbtiType, aiPreference);
    if (!aiResponse || !aiResponse.response) throw new Error('Failed to generate chat response');

    // Save AI response to session
    await addMessageToSession(userId, sessionId, aiResponse.response, 'assistant');

    const firstResponse = {
      response: aiResponse.response,
      sentiment,
      userContext: { mbtiType, aiPreference },
      recommendations: []
    };

    // Check if the user has a learning intent
    const intent = await determineLearningIntent(message, chatHistory);

    if (intent === 'learning') {
      // Add recommendations for learning-focused messages
      const searchPhrase = await extractKeyword(message);
      const contentItems = await fetchCombinedContent(searchPhrase);

      if (contentItems.length) {
        const recommendationsText = `Here are some helpful resources:\n` +
          contentItems.map(item => `• ${item.title}`).join('\n');

        // Save recommendations as a separate assistant message
        await addMessageToSession(userId, sessionId, recommendationsText, 'assistant');

        return [firstResponse, {
          response: recommendationsText,
          sentiment,
          userContext: { mbtiType, aiPreference },
          recommendations: contentItems
        }];
      }
    }

    return firstResponse;

  } catch (error) {
    console.error('Error processing chat message:', error);
    throw error;
  }
};

/**
 * Migrate user from old chat history to session-based system
 */
export const migrateToSessions = async (userId: string): Promise<void> => {
  if (!userId) return;
  
  try {
    // Check if user already has sessions
    const sessionsRef = doc(db, 'chatSessions', userId);
    const sessionsDoc = await getDoc(sessionsRef);
    
    if (sessionsDoc.exists()) {
      // Already migrated
      return;
    }
    
    // Get old chat history
    const chatRef = doc(db, 'chatHistory', userId);
    const chatDoc = await getDoc(chatRef);
    
    if (!chatDoc.exists() || !chatDoc.data().messages || chatDoc.data().messages.length === 0) {
      // No history to migrate, just initialize session doc
      await initializeSessionsDoc(userId);
      return;
    }
    
    // Create a new session with the old messages
    const sessionId = `session_${Date.now()}`;
    const oldMessages = chatDoc.data().messages || [];
    
    // Create title from first user message
    let title = 'Imported Conversation';
    const firstUserMsg = oldMessages.find((m: ChatMessage) => m.role === 'user');
    if (firstUserMsg) {
      const words = firstUserMsg.content.split(' ');
      title = words.slice(0, 4).join(' ') + (words.length > 4 ? '...' : '');
    }
    
    const newSession: ChatSession = {
      id: sessionId,
      title,
      createdAt: new Date(oldMessages[0]?.timestamp || Date.now()).toISOString(),
      lastActiveAt: new Date(oldMessages[oldMessages.length - 1]?.timestamp || Date.now()).toISOString(),
      messages: oldMessages
    };
    
    // Create sessions document with migrated data
    await setDoc(sessionsRef, {
      userId,
      activeSessions: [newSession],
      archivedSessions: [],
      currentSessionId: sessionId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error migrating to sessions:', error);
  }
};

/**
 * Clear all chat history for a user
 */
export const clearAllChatHistory = async (userId: string): Promise<void> => {
  if (!userId) return;
  
  try {
    // Delete old chat history
    const chatRef = doc(db, 'chatHistory', userId);
    await deleteDoc(chatRef);
    
    // Delete sessions
    const sessionsRef = doc(db, 'chatSessions', userId);
    await deleteDoc(sessionsRef);
    
    // Initialize a fresh sessions document
    await initializeSessionsDoc(userId);
  } catch (error) {
    console.error('Error clearing chat history:', error);
    throw error;
  }
};
