import cron from 'node-cron';
import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { CONTENT_CATEGORIES, generateContent, publishContent } from '../src/lib/contentGenerator.ts';

config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const SYSTEM_USER_ID = 'ai-content-generator';

async function generateDailyContent() {
  try {
    console.log('Starting daily content generation...');

    // Generate one post for each category
    for (const category of CONTENT_CATEGORIES) {
      console.log(`Generating content for category: ${category.name}`);
      
      try {
        const content = await generateContent(category);
        const postId = await publishContent(content, SYSTEM_USER_ID);
        
        console.log(`Published post ${postId} for category ${category.name}`);
        
        // Add delay between posts to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Optionally, save the post to Firestore
        await addDoc(collection(db, 'posts'), {
          content,
          category: category.name,
          userId: SYSTEM_USER_ID,
          timestamp: serverTimestamp()
        });
      } catch (error) {
        console.error(`Error generating or publishing content for category ${category.name}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in daily content generation:', error);
    process.exit(1);
  }
}

// Schedule daily content generation (runs at 00:00 every day)
cron.schedule('0 0 * * *', () => {
  console.log('Running scheduled content generation...');
  generateDailyContent().catch(console.error);
});

// Also allow manual execution
if (import.meta.url === `file://${process.argv[1]}`) {
  generateDailyContent().catch(console.error);
}