import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit as firebaseLimit, serverTimestamp, or, and } from 'firebase/firestore';
import OpenAI from 'openai';
import { getLatestAssessment } from './api';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export interface Tutorial {
  id: string;
  userId: string;
  title: string;
  content: string;
  category: string;
  difficulty: string;
  likes: number;
  views: number;
  estimatedMinutes: number;
  createdAt: any;
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
          content: `Return ONLY one of the following categories exactly (without any additional text): ${TUTORIAL_CATEGORIES.join(', ')}.`
        },
        {
          role: 'user',
          content: `Title: ${title}\n\nContent: ${content}`
        }
      ]
    });
    let categoryResponse = (categoryCompletion.choices?.[0]?.message?.content ?? '').trim();
    if (!TUTORIAL_CATEGORIES.includes(categoryResponse)) {
      // Attempt to find one of the predefined categories in the response
      categoryResponse = TUTORIAL_CATEGORIES.find(cat => categoryResponse.includes(cat)) || TUTORIAL_CATEGORIES[0];
    }
    const category = categoryResponse;

    // Save tutorial to Firestore
    const tutorialRef = await addDoc(collection(db, 'tutorials'), {
      title,
      content: body,
      category,
      difficulty: 'intermediate',
      tags: [category, query, mbtiType || 'General'],
      estimatedMinutes: Math.ceil(body.split(' ').length / 200),
      createdAt: new Date(), // <-- changed from serverTimestamp() to new Date()
      likes: 0,
      views: 0,
      userId,
      mbtiType,
      aiPreference,
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

export const getRecommendedTutorials = async (userId: string, completedTutorialIds: string[], limit = 3) => {
  try {
    const tutorialsRef = collection(db, 'tutorials');
    const assessment = await getLatestAssessment(userId);
    const preferredMbti = assessment.data?.mbti_type;

    let combinedQuery;
    if (preferredMbti) {
      combinedQuery = query(
        tutorialsRef,
        or(
          where('userId', '==', userId),
          and(
            where('userId', '!=', userId),
            where('mbtiType', '==', preferredMbti)
          )
        ),
        orderBy('likes', 'desc'),
        orderBy('createdAt', 'desc')
      );
    } else {
      // Fallback if no preferredMbti: only user-created tutorials
      combinedQuery = query(
        tutorialsRef,
        where('userId', '==', userId),
        orderBy('likes', 'desc'),
        orderBy('createdAt', 'desc')
      );
    }

    const snapshot = await getDocs(combinedQuery);
    let tutorials: Tutorial[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Tutorial[];
    tutorials = tutorials.filter(t => !completedTutorialIds.includes(t.id));
    tutorials.sort((a, b) => {
      if (b.likes !== a.likes) return b.likes - a.likes;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return tutorials.slice(0, limit);
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