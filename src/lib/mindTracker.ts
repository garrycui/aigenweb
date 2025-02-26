import { db } from './firebase';
import { doc, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, limit } from 'firebase/firestore';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export interface MoodEntry {
  id: string;
  rating: number;
  mood: string;
  notes: string;
  tags: string[];
  createdAt: any;
}

export interface MoodAnalysis {
  trend: 'improving' | 'declining' | 'stable';
  averageRating: number;
  commonTags: string[];
  suggestions: string[];
  riskLevel: 'low' | 'moderate' | 'high';
}

/**
 * Save a new mood entry
 */
export const saveMoodEntry = async (
  userId: string,
  rating: number,
  mood: string,
  notes: string,
  tags: string[] = []
) => {
  try {
    const collRef = collection(db, 'users', userId, 'moodEntries');
    const docRef = await addDoc(collRef, {
      rating,
      mood,
      notes,
      tags,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving mood entry:', error);
    throw error;
  }
};

/**
 * Get mood entries for a date range
 */
export const getMoodEntries = async (
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<MoodEntry[]> => {
  try {
    const collRef = collection(db, 'users', userId, 'moodEntries');
    let q = query(collRef, orderBy('createdAt', 'desc'));

    if (startDate) {
      q = query(q, where('createdAt', '>=', startDate));
    }
    if (endDate) {
      q = query(q, where('createdAt', '<=', endDate));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MoodEntry));
  } catch (error) {
    console.error('Error getting mood entries:', error);
    throw error;
  }
};

/**
 * Analyze mood entries and provide insights
 */
export const analyzeMoodEntries = async (entries: MoodEntry[]): Promise<MoodAnalysis> => {
  if (entries.length === 0) {
    return {
      trend: 'stable',
      averageRating: 0,
      commonTags: [],
      suggestions: [],
      riskLevel: 'low'
    };
  }

  // Calculate trend
  const ratings = entries.map(e => e.rating);
  const averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  
  // Calculate trend using linear regression
  const xValues = Array.from({ length: ratings.length }, (_, i) => i);
  const slope = calculateSlope(xValues, ratings);
  
  const trend = slope > 0.1 ? 'improving' : slope < -0.1 ? 'declining' : 'stable';

  // Get common tags
  const tagCounts = new Map<string, number>();
  entries.forEach(entry => {
    entry.tags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  const commonTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  // Determine risk level
  const recentEntries = entries.slice(0, 7); // Last 7 entries
  const recentAverage = recentEntries.reduce((sum, entry) => sum + entry.rating, 0) / recentEntries.length;
  const riskLevel = recentAverage <= 3 ? 'high' : recentAverage <= 5 ? 'moderate' : 'low';

  // Get AI-powered suggestions
  const suggestions = await generateSuggestions(entries, trend, riskLevel);

  return {
    trend,
    averageRating,
    commonTags,
    suggestions,
    riskLevel
  };
};

/**
 * Calculate slope for trend analysis
 */
const calculateSlope = (x: number[], y: number[]): number => {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
};

/**
 * Generate personalized suggestions using AI
 */
const generateSuggestions = async (
  entries: MoodEntry[],
  trend: string,
  riskLevel: string
): Promise<string[]> => {
  try {
    const prompt = `
      Based on the following mood data:
      - Trend: ${trend}
      - Risk Level: ${riskLevel}
      - Recent moods: ${entries.slice(0, 3).map(e => e.mood).join(', ')}
      - Common tags: ${entries.slice(0, 3).flatMap(e => e.tags).join(', ')}

      Provide 3 specific, actionable suggestions to improve mental well-being.
      Focus on practical steps that can be taken immediately.
      Keep each suggestion concise (under 100 characters).
      Format as a simple list.
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a supportive mental health assistant.' },
        { role: 'user', content: prompt }
      ]
    });

    const suggestions = completion.choices[0].message?.content
      ?.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 3) || [];

    return suggestions;
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return [
      'Take a few deep breaths and practice mindfulness',
      'Connect with a friend or family member',
      'Do something you enjoy for at least 15 minutes'
    ];
  }
};

/**
 * Get recommended resources based on mood analysis
 */
export const getRecommendedResources = async (userId: string, analysis: MoodAnalysis) => {
  // Query tutorials and forum posts that match the user's current needs
  const tutorialsRef = collection(db, 'tutorials');
  const postsRef = collection(db, 'posts');

  let relevantTutorials = [];
  let relevantPosts = [];

  // Add tutorial recommendations based on risk level
  if (analysis.riskLevel === 'high') {
    const wellbeingTutorials = query(
      tutorialsRef,
      where('category', '==', 'Mental Well-being'),
      limit(2)
    );
    const snapshot = await getDocs(wellbeingTutorials);
    relevantTutorials = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  // Add community post recommendations
  const supportPosts = query(
    postsRef,
    where('category', '==', 'Support'),
    orderBy('likes_count', 'desc'),
    limit(2)
  );
  const postsSnapshot = await getDocs(supportPosts);
  relevantPosts = postsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  return {
    tutorials: relevantTutorials,
    posts: relevantPosts
  };
};