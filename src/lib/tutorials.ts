import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import OpenAI from 'openai';
import { getLatestAssessment } from './api';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export interface Tutorial {
  id: string;
  title: string;
  content: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  estimatedMinutes: number;
  createdAt: Date;
  likes: number;
  views: number;
  images?: { url: string; caption: string; }[];
}

export const TUTORIAL_CATEGORIES = [
  'AI Tools',
  'Productivity',
  'Communication',
  'Technical Skills',
  'Workplace Integration',
  'Career Development'
];

const generateTutorialPrompt = (query: string, mbtiType?: string, aiPreference?: string) => {
  return `
    Create a detailed, step-by-step tutorial about "${query}" for someone with MBTI type ${mbtiType || 'unknown'} 
    who is ${aiPreference || 'learning about'} AI.
    
    The tutorial should include:
    1. A clear, engaging title
    2. Brief introduction explaining the importance/relevance
    3. Prerequisites or required tools
    4. Step-by-step instructions with detailed explanations
    5. Best practices and tips
    6. Common pitfalls to avoid
    7. Troubleshooting guide
    8. Summary and next steps
    
    Format the content using markdown.
    Make steps clear and actionable.
    Include specific examples where appropriate.
    Consider the user's MBTI type in the explanation style:
    - For introverts (I): More detailed written explanations
    - For extroverts (E): More interactive examples
    - For sensing (S): Concrete, practical steps
    - For intuition (N): Conceptual understanding
    - For thinking (T): Logical frameworks
    - For feeling (F): Real-world impact
    - For judging (J): Structured approach
    - For perceiving (P): Flexible alternatives

    Target a reading time of 10-15 minutes.
  `;
};

export const generateTutorial = async (userId: string, query: string) => {
  try {
    // Get user's assessment results for personalization
    const { data: assessment } = await getLatestAssessment(userId);
    const mbtiType = assessment?.mbti_type;
    const aiPreference = assessment?.ai_preference;

    // Generate tutorial content using ChatGPT
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert AI adaptation coach creating tutorials.'
        },
        {
          role: 'user',
          content: generateTutorialPrompt(query, mbtiType, aiPreference)
        }
      ]
    });

    const content = completion.choices[0].message?.content;
    if (!content) {
      throw new Error('Failed to generate tutorial content');
    }

    // Parse the markdown content to extract title and body
    const lines = content.split('\n');
    const title = lines[0].replace(/^#\s+/, '');
    const body = lines.slice(1).join('\n');

    // Determine category based on content
    const categoryCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Categorize this tutorial into one of these categories: ${TUTORIAL_CATEGORIES.join(', ')}`
        },
        {
          role: 'user',
          content: `Title: ${title}\n\nContent: ${content}`
        }
      ]
    });

    const category = categoryCompletion.choices[0].message?.content || TUTORIAL_CATEGORIES[0];

    // Save tutorial to Firestore
    const tutorialRef = await addDoc(collection(db, 'tutorials'), {
      title,
      content: body,
      category,
      difficulty: 'intermediate',
      tags: [category, query, mbtiType || 'General'],
      estimatedMinutes: Math.ceil(body.split(' ').length / 200),
      createdAt: serverTimestamp(),
      likes: 0,
      views: 0,
      userId,
      mbtiType,
      aiPreference
    });

    return {
      id: tutorialRef.id,
      title,
      content: body,
      category
    };
  } catch (error) {
    console.error('Error generating tutorial:', error);
    throw error;
  }
};

export const getRecommendedTutorials = async (userId: string, lim = 3) => {
  try {
    const { data: assessment } = await getLatestAssessment(userId);
    const mbtiType = assessment?.mbti_type;
    const aiPreference = assessment?.ai_preference;

    const tutorialsRef = collection(db, 'tutorials');
    const constraints: any[] = [];
    if (mbtiType) {
      constraints.push(where('mbtiType', '==', mbtiType));
    }
    if (aiPreference) {
      constraints.push(where('aiPreference', '==', aiPreference));
    }
    constraints.push(orderBy('views', 'desc'));
    constraints.push(limit(lim));

    const tutorialQuery = query(tutorialsRef, ...constraints);
    const snapshot = await getDocs(tutorialQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Tutorial[];
  } catch (error) {
    console.error('Error getting recommended tutorials:', error);
    return [];
  }
};

// Updated getTutorials function without using 'offset'
export const getTutorials = async (
  page: number = 1,
  limitVal: number = 10,
  searchQuery?: string,
  category?: string,
  difficulty?: string,
  sortField: string = 'createdAt',
  sortDirection: 'asc' | 'desc' = 'desc'
) => {
  try {
    const tutorialsRef = collection(db, 'tutorials');
    const constraints: any[] = [];
    // Remove Firestore filter for category; filter client‑side instead
    if (difficulty) {
      constraints.push(where('difficulty', '==', difficulty));
    }
    constraints.push(orderBy(sortField, sortDirection));
    const tutorialQuery = query(tutorialsRef, ...constraints);
    const snapshot = await getDocs(tutorialQuery);
    
    // Manually paginate in-memory
    const lowerBound = (page - 1) * limitVal;
    const upperBound = lowerBound + limitVal;
    const docs = snapshot.docs.slice(lowerBound, upperBound);
    
    let tutorials = docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Tutorial[];

    // Client-side filtering for search text, if provided
    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      tutorials = tutorials.filter(t =>
        t.title.toLowerCase().includes(queryLower) ||
        t.content.toLowerCase().includes(queryLower) ||
        t.category.toLowerCase().includes(queryLower)
      );
    }
    // Client-side filtering for category, case-insensitive
    if (category) {
      const catLower = category.toLowerCase();
      tutorials = tutorials.filter(t => t.category.toLowerCase() === catLower);
    }
    return tutorials;
  } catch (error) {
    console.error('Error getting tutorials:', error);
    return [];
  }
};