import OpenAI from 'openai';
import { searchWeb, getImageSuggestions } from './webSearch.ts';
import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

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

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

interface ContentCategory {
  id: string;
  name: string;
  description: string;
  searchQueries: string[];
  preferredMediaType: 'image' | 'video' | 'both';
}

export const CONTENT_CATEGORIES: ContentCategory[] = [
  {
    id: 'income-opportunities',
    name: 'AI-Powered Income Opportunities',
    description: 'Strategies to leverage AI for financial gain',
    searchQueries: [
      'how to make money with AI tools',
      'AI side hustle opportunities',
      'monetize artificial intelligence skills'
    ],
    preferredMediaType: 'both'
  },
  {
    id: 'innovations',
    name: 'Cutting-Edge AI Innovations',
    description: 'Latest developments in AI technology',
    searchQueries: [
      'latest AI breakthroughs',
      'new artificial intelligence research',
      'AI technology innovations'
    ],
    preferredMediaType: 'both'
  },
  {
    id: 'future-trends',
    name: 'The Future of AI: Trends and Predictions',
    description: 'Upcoming trends and forecasts in AI',
    searchQueries: [
      'AI industry trends',
      'future of artificial intelligence',
      'AI technology predictions'
    ],
    preferredMediaType: 'both'
  },
  {
    id: 'career-transitions',
    name: 'Navigating AI-Induced Career Transitions',
    description: 'Guidance on adapting careers to AI changes',
    searchQueries: [
      'AI career transition strategies',
      'reskilling for AI jobs',
      'AI impact on careers'
    ],
    preferredMediaType: 'both'
  },
  {
    id: 'mental-wellbeing',
    name: 'Mental Well-being in the AI Era',
    description: 'Support for managing psychological impacts of AI',
    searchQueries: [
      'coping with AI anxiety',
      'mental health AI workplace',
      'psychological impact of AI'
    ],
    preferredMediaType: 'both'
  },
  {
    id: 'ethics',
    name: 'AI Ethics and Responsible Use',
    description: 'Ethical considerations in AI deployment',
    searchQueries: [
      'AI ethics guidelines',
      'responsible AI development',
      'artificial intelligence ethics'
    ],
    preferredMediaType: 'both'
  },
  {
    id: 'success-stories',
    name: 'AI Success Stories and Case Studies',
    description: 'Real-world examples of positive AI outcomes',
    searchQueries: [
      'successful AI implementations',
      'AI transformation case studies',
      'AI business success stories'
    ],
    preferredMediaType: 'both'
  }
];

interface Source {
  title: string;
  url: string;
  snippet: string;
  type: 'article' | 'video';
  thumbnailUrl?: string;
  videoId?: string;
}

interface GeneratedContent {
  title: string;
  content: string;
  category: string;
  sources: Source[];
  imageUrl?: string;
  videoUrl?: string;
}

const generatePrompt = (category: ContentCategory, sources: Source[]): string => {
  const sourceText = sources.map(s => `${s.title} (${s.type}): ${s.snippet}`).join('\n');
  
  return `
    Create an informative and engaging forum post about ${category.description}.
    
    Use these sources for reference:
    ${sourceText}
    
    Requirements:
    1. Write in a professional yet conversational tone
    2. Include specific examples and data points from the sources
    3. Add proper attribution for any facts or quotes
    4. Structure the content with clear sections
    5. Reference the included ${category.preferredMediaType === 'both' ? 'image and video' : category.preferredMediaType} content
    6. End with discussion questions to engage readers
    
    Format:
    - Title: Create an attention-grabbing title
    - Content: Write 500-800 words
    - Sources: Include numbered references
    
    Focus on providing actionable insights and valuable information for readers.
  `;
};

export const generateContent = async (category: ContentCategory): Promise<GeneratedContent> => {
  try {
    // Search for relevant content
    const sources = await searchWeb(category.searchQueries[0], 5);
    
    // Find relevant media based on category preference
    let imageUrl: string | undefined;
    let videoUrl: string | undefined;

    if (category.preferredMediaType === 'image' || category.preferredMediaType === 'both') {
      const images = await getImageSuggestions(category.searchQueries[0]);
      if (images.length > 0) {
        imageUrl = images[0];
      }
    }

    if (category.preferredMediaType === 'video' || category.preferredMediaType === 'both') {
      const videoSource = sources.find(s => s.type === 'video');
      if (videoSource?.videoId) {
        videoUrl = videoSource.url;
      }
    }

    // Generate content using ChatGPT
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert content writer specializing in AI topics.'
        },
        {
          role: 'user',
          content: generatePrompt(category, sources)
        }
      ]
    });

    const response = completion.choices[0].message?.content;
    if (!response) {
      throw new Error('Failed to generate content');
    }

    // Parse the response
    const lines = response.split('\n');
    const title = lines[0].replace('Title: ', '');
    const content = lines.slice(1).join('\n');

    return {
      title,
      content,
      category: category.name,
      sources,
      imageUrl,
      videoUrl
    };
  } catch (error) {
    console.error('Error generating content:', error);
    throw error;
  }
};

export const publishContent = async (content: GeneratedContent, userId: string) => {
  try {
    const postRef = await addDoc(collection(db, 'posts'), {
      title: content.title,
      content: content.content,
      category: content.category,
      image_url: content.imageUrl,
      video_url: content.videoUrl,
      sources: content.sources,
      userId,
      user_name: 'AI Content Generator',
      likes_count: 0,
      comments_count: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return postRef.id;
  } catch (error) {
    console.error('Error publishing content:', error);
    throw error;
  }
};