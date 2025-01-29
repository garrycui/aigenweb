import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence, collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Persistence failed: Multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Persistence not available in this browser');
  }
});

// Initialize collections for a user
export const initializeUserCollections = async (userId: string) => {
  try {
    // Initialize dailyContent collection
    const dailyContentRef = doc(collection(db, 'dailyContent'), userId);
    await setDoc(dailyContentRef, {
      userId,
      content: "Welcome to your AI adaptation journey!",
      type: "quote",
      createdAt: serverTimestamp()
    }, { merge: true });

    // Initialize chatHistory collection
    const chatHistoryRef = doc(collection(db, 'chatHistory'), userId);
    await setDoc(chatHistoryRef, {
      userId,
      messages: [],
      createdAt: serverTimestamp()
    }, { merge: true });

    // Initialize recommendations collection
    const recommendationsRef = doc(collection(db, 'recommendations'), userId);
    await setDoc(recommendationsRef, {
      userId,
      posts: [],
      createdAt: serverTimestamp()
    }, { merge: true });

    console.log('User collections initialized successfully');
  } catch (error) {
    console.error('Error initializing user collections:', error);
  }
};

// Initialize collections when user signs in
auth.onAuthStateChanged(async (user) => {
  if (user) {
    await initializeUserCollections(user.uid);
  }
});