import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit as firebaseLimit, serverTimestamp, or, and } from 'firebase/firestore';
import OpenAI from 'openai';
import { getLatestAssessment } from './api';
import axios from 'axios';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

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
  introImageUrl?: string;
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
    (Do Not Explicitly Mention MBTI, but Apply in Content Approach)
    - **For strategic learners:** Include structured explanations and frameworks.
    - **For conceptual learners:** Use real-world applications and storytelling.
    - **For hands-on learners:** Provide interactive examples and step-by-step exercises.
    - **For impact-driven individuals:** Highlight social and professional benefits.
    who is ${aiPreference || 'learning about'} AI.
    - **Enthusiastic Learners:** Provide deeper insights and encourage experimentation.
    - **Optimistic Learners:** Emphasize AI's positive impact on daily life.
    - **Cautious Learners:** Offer balanced perspectives with safety best practices.
    - **Resistant Learners:** Focus on demystifying AI and building trust. 

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
   
    Target a reading time of 10-15 minutes.

    Include a markdown image placeholder at the end for the summary: ![Summary Image](GENERATE_IMAGE_SUMMARY)

    Make the tutorial visually appealing and easy to follow, with clear formatting. Place an image at the end
    to aid understanding. Ensure high-quality, in-depth explanations so users can truly learn the topic.
  `;
};

// 📌 **Extracts Key Points from Tutorial Content**
const extractKeyPoints = (text: string, maxPoints: number = 3): string => {
  const sentences = text.split('.').map(s => s.trim()).filter(s => s.length > 0);
  return sentences.slice(0, maxPoints).join(', ');
};

// Get image suggestions from Unsplash
export const getImageSuggestions = async (query: string): Promise<string[]> => {
  try {
    const response = await axios.get(`https://api.unsplash.com/search/photos`, {
      params: {
        query,
        per_page: 5,
        client_id: UNSPLASH_ACCESS_KEY
      }
    });

    return response.data.results.map((img: any) => img.urls.regular);
  } catch (error) {
    console.error('Error fetching images:', error);
    return [];
  }
};

async function getUnsplashImage(query: string): Promise<string> {
  try {
    const images = await getImageSuggestions(query);
    return images.length > 0 ? images[0] : '';
  } catch (error) {
    console.error('Error fetching Unsplash image:', error);
    return ''; // Return an empty string if the request fails
  }
}

async function replaceImagePlaceholder(body: string, query: string): Promise<string> {
  const placeholderRegex = /!\[.*?\]\(GENERATE_IMAGE_SUMMARY\)/;
  const match = body.match(placeholderRegex);
  if (!match) return body;

  try {
    // 🔹 Extract key tutorial points to improve image prompt relevance
    const keyPoints = extractKeyPoints(body, 3);
    const detailedPrompt = `
      Generate a **high-quality, informative** image for a tutorial on "${query}".
      The image should **visually represent**:
      - **Topic:** ${query}
      - **Key points:** ${keyPoints}
      - **Illustration type:** Clear, structured, visually engaging infographic
      - **Target audience:** Professionals, students, and tech learners
      - **Color scheme:** Modern, professional, visually appealing

      Ensure the image is **directly related to the tutorial content** and provides **a clear, easy-to-understand summary**.
    `;

    // 🔹 Request OpenAI's DALL·E API to generate an image
    const generatedImage = await openai.images.generate({
      prompt: detailedPrompt,
      size: '1024x1024',  // Ensures high-resolution image
      style: 'natural',  // Requests a more visually accurate image
      quality: 'hd'        // Ensures higher image quality
    });

    const imageUrl = generatedImage.data?.[0]?.url || '';

    if (!imageUrl) {
      console.warn('OpenAI image generation failed, falling back to Unsplash...');
      const unsplashUrl = await getUnsplashImage(query);
      return body.replace(placeholderRegex, `![Summary Image](${unsplashUrl})`);
    }

    return body.replace(placeholderRegex, `![Summary Image](${imageUrl})`);
  } catch (error) {
    console.error('Error generating tutorial image:', error);
    return body;
  }
}

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

    // Get Unsplash image for introduction
    const introImageUrl = await getUnsplashImage(query);

    // Parse the markdown content to extract title and body
    const lines = content.split('\n');
    const title = lines[0].replace(/^#\s+/, '');
    const body = lines.slice(1).join('\n');
    const finalBody = await replaceImagePlaceholder(body, query);

    // Add extra space between sections
    const formattedBody = finalBody.replace(/(\n\s*\n)/g, '\n\n\n');

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
      content: formattedBody,
      category,
      difficulty: 'intermediate',
      tags: [category, query, mbtiType || 'General'],
      estimatedMinutes: Math.ceil(formattedBody.split(' ').length / 200),
      createdAt: new Date(), // <-- changed from serverTimestamp() to new Date()
      likes: 0,
      views: 0,
      userId,
      mbtiType,
      aiPreference,
      introImageUrl
    });

    return {
      id: tutorialRef.id,
      title,
      content: formattedBody,
      category,
      introImageUrl
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