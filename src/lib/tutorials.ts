import OpenAI from 'openai';
import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, orderBy, or, and, doc, updateDoc, increment } from 'firebase/firestore';
import { getLatestAssessment } from './api';
import axios from 'axios';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

// Enhanced tutorial interface with new fields
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
  isCodingTutorial: boolean;
  sections: TutorialSection[];
  resources: {
    webLinks: WebResource[];
    videos: VideoResource[];
  };
  quiz: QuizData;
}

interface TutorialSection {
  id: string;
  title: string;
  content: string;
  codeExample?: string;
  language?: string;
}

interface WebResource {
  title: string;
  url: string;
  description: string;
  thumbnail?: string;
}

interface VideoResource {
  title: string;
  url: string;
  description: string;
  thumbnail: string;
}

interface QuizData {
  questions: QuizQuestion[];
  passingScore: number;
}

interface QuizQuestion {
  id: number;
  type: 'multiple-choice' | 'true-false' | 'fill-in-blank';
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

// Tutorial categories
export const TUTORIAL_CATEGORIES = [
  'AI Tools',
  'Productivity',
  'Communication',
  'Technical Skills',
  'Workplace Integration',
  'Career Development'
];

// Tutorial prompt generator based on difficulty level
const generateTutorialPrompt = (query: string, difficulty: string, mbtiType?: string, aiPreference?: string) => {
  const difficultyGuides = {
    beginner: {
      style: 'Use simple language and explain every concept from scratch. Break down complex terms.',
      depth: 'Focus on foundational concepts and basic practical applications.',
      examples: 'Provide many step-by-step examples with detailed explanations.',
      assumptions: 'Assume no prior knowledge of the subject.',
      codeStyle: 'Include basic code examples with extensive comments explaining each line.'
    },
    intermediate: {
      style: 'Use professional terminology with clear explanations. Balance theory and practice.',
      depth: 'Cover moderately complex concepts and real-world applications.',
      examples: 'Provide practical examples that build upon basic knowledge.',
      assumptions: 'Assume basic understanding of the subject.',
      codeStyle: 'Include moderate complexity code examples with focused comments on key concepts.'
    },
    advanced: {
      style: 'Use technical language and industry-standard terminology.',
      depth: 'Explore advanced concepts, edge cases, and optimizations.',
      examples: 'Provide complex, real-world examples and best practices.',
      assumptions: 'Assume strong foundational knowledge.',
      codeStyle: 'Include advanced code examples with comments on sophisticated techniques.'
    }
  };

  const guide = difficultyGuides[difficulty as keyof typeof difficultyGuides];

  return `
    Create a detailed, ${difficulty}-level tutorial about "${query}" for someone with MBTI type ${mbtiType || 'unknown'} 
    (Do Not Explicitly Mention MBTI, but Apply in Content Approach)
    who is ${aiPreference || 'learning about'} AI.

    Writing Style:
    ${guide.style}

    Content Depth:
    ${guide.depth}

    Examples Approach:
    ${guide.examples}

    Knowledge Assumptions:
    ${guide.assumptions}

    Code Examples:
    ${guide.codeStyle}

    The tutorial should include:
    1. A clear, engaging title appropriate for ${difficulty} level
    2. Brief introduction explaining the importance/relevance
    3. Prerequisites or required tools (aligned with ${difficulty} level)
    4. Step-by-step instructions with detailed explanations
    5. Best practices and tips
    6. Common pitfalls to avoid
    7. Troubleshooting guide
    8. Summary and next steps for further learning

    Format the content using markdown with clear section headers (##).
    Make steps clear and actionable.
    Include specific examples where appropriate.
    If code is involved, wrap it in markdown code blocks with language specification.
   
    Target a reading time of:
    - Beginner: 15-20 minutes
    - Intermediate: 12-15 minutes
    - Advanced: 10-12 minutes

    Make the tutorial visually appealing and easy to follow while maintaining the appropriate difficulty level.
    Ensure high-quality, in-depth explanations that match the selected difficulty level.
  `;
};

// Enhanced tutorial generation
export const generateTutorial = async (userId: string, query: string, difficulty: string) => {
  try {
    const refinedTitle = await refineTopic(query, difficulty);
    const { data: assessment } = await getLatestAssessment(userId);
    const mbtiType = assessment?.mbti_type || '';
    const aiPreference = assessment?.ai_preference || '';

    // Generate main content with difficulty level
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert AI adaptation coach creating tutorials.'
        },
        {
          role: 'user',
          content: generateTutorialPrompt(refinedTitle, difficulty, mbtiType, aiPreference)
        }
      ]
    });

    const content = completion.choices[0].message?.content;
    if (!content) throw new Error('Failed to generate tutorial content');

    // Parse content into sections
    const sections = parseSections(content);
    const isCodingTutorial = detectCodeContent(content);

    // Fetch resources
    const [webResources, videoResources] = await Promise.all([
      fetchWebResources(refinedTitle),
      fetchVideoResources(refinedTitle)
    ]);

    // Generate quiz
    const quiz = await generateQuiz(content);

    // Determine category
    const category = await determineCategory(refinedTitle, content);

    // Ensure all fields have valid values
    const tutorialData = {
      title: refinedTitle,
      content,
      sections,
      isCodingTutorial,
      category,
      difficulty,
      resources: {
        webLinks: webResources || [],
        videos: videoResources || []
      },
      quiz: quiz || { questions: [], passingScore: 70 },
      estimatedMinutes: Math.ceil(content.split(' ').length / 200),
      createdAt: new Date(),
      likes: 0,
      views: 0,
      userId,
      mbtiType,
      aiPreference
    };

    // Save to Firestore
    const tutorialRef = await addDoc(collection(db, 'tutorials'), tutorialData);

    return {
      id: tutorialRef.id,
      ...tutorialData
    };
  } catch (error) {
    console.error('Error generating tutorial:', error);
    throw error;
  }
};

// Refined topic generation with difficulty consideration
const refineTopic = async (query: string, difficulty: string): Promise<string> => {
  const prompt = `
    Convert this broad topic into a specific, clear tutorial title.
    Topic: "${query}"
    Difficulty Level: ${difficulty}
    Requirements:
    - Be specific and actionable
    - Focus on practical skills
    - Use clear, professional language
    - Keep it under 60 characters
    - Match the ${difficulty} difficulty level
    Title:
  `;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a technical tutorial title generator.' },
      { role: 'user', content: prompt }
    ]
  });

  return completion.choices[0].message?.content?.trim() || query;
};

// Fetch web resources using Google Custom Search API
const fetchWebResources = async (query: string): Promise<WebResource[]> => {
  try {
    console.log('query:', query);
    const sanitizedQuery = query.replace(/^["'](.*)["']$/, '$1');
    const params: any = {
      key: import.meta.env.VITE_GOOGLE_API_KEY,
      cx: import.meta.env.VITE_GOOGLE_SEARCH_ENGINE_ID,
      q: sanitizedQuery,
      num: 5,
    };
    console.log('Google Custom Search API params:', params);

    const response = await axios.get('https://www.googleapis.com/customsearch/v1', { params });
    console.log('Google Custom Search API response:', response.data);

    if (!response.data.items) {
      console.log('No items found in the response');
      return [];
    }

    return response.data.items.map((item: any) => {
      const resource = {
        title: item.title,
        url: item.link,
        description: item.snippet,
        thumbnail: item.pagemap?.cse_thumbnail?.[0]?.src,
      };
      console.log('Resource:', resource);
      return resource;
    });
  } catch (error) {
    console.error('Error fetching web resources:', error);
    return [];
  }
};

// Fetch video resources using YouTube Data API
const fetchVideoResources = async (query: string): Promise<VideoResource[]> => {
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        key: import.meta.env.VITE_YOUTUBE_API_KEY,
        q: query,
        part: 'snippet',
        type: 'video',
        videoEmbeddable: true,
        videoDefinition: 'high',
        maxResults: 3
      }
    });

    return response.data.items.map((item: any) => ({
      title: item.snippet.title,
      url: `https://www.youtube.com/embed/${item.id.videoId}`,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.high.url
    }));
  } catch (error) {
    console.error('Error fetching video resources:', error);
    return [];
  }
};

// Generate quiz questions
const generateQuiz = async (content: string): Promise<QuizData> => {
  const prompt = `
    Generate a quiz based on this tutorial content:
    "${content}"
    Requirements:
    - Create 5 multiple-choice questions
    - Each question should have 4 options
    - Include explanations for correct answers
    - Focus on key learning points
    Format as JSON with structure:
    {
      "questions": [
        {
          "id": number,
          "type": "multiple-choice",
          "question": string,
          "options": string[],
          "correctAnswer": number,
          "explanation": string
        }
      ],
      "passingScore": number
    }
  `;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a quiz generator for technical tutorials.' },
      { role: 'user', content: prompt }
    ]
  });

  try {
    let content = completion.choices[0].message?.content || '{"questions":[],"passingScore":70}';
    content = content.replace(/```json\s*([\s\S]*?)\s*```/, '$1').trim();
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing quiz JSON:', error);
    return { questions: [], passingScore: 70 };
  }
};

// Helper functions
const parseSections = (content: string): TutorialSection[] => {
  const sections: TutorialSection[] = [];
  const lines = content.split('\n');
  let currentSection: Partial<TutorialSection> = {};

  lines.forEach(line => {
    if (line.startsWith('## ')) {
      if (currentSection.title) {
        sections.push(currentSection as TutorialSection);
      }
      currentSection = {
        id: Date.now().toString(),
        title: line.replace('## ', '').trim(),
        content: ''
      };
    } else if (line.includes('```')) {
      const language = line.replace('```', '').trim();
      if (language && !currentSection.language) {
        currentSection.language = language;
        currentSection.codeExample = '';
      } else if (currentSection.codeExample !== undefined) {
        currentSection.content += currentSection.codeExample + '\n';
        delete currentSection.codeExample;
      }
    } else if (currentSection.codeExample !== undefined) {
      currentSection.codeExample += line + '\n';
    } else if (currentSection.title) {
      currentSection.content += line + '\n';
    }
  });

  if (currentSection.title) {
    sections.push(currentSection as TutorialSection);
  }

  return sections;
};

const detectCodeContent = (content: string): boolean => {
  return content.includes('```') || 
         content.includes('function') || 
         content.includes('class') || 
         content.includes('const') || 
         content.includes('let');
};

// Determine category based on content
const determineCategory = async (title: string, content: string): Promise<string> => {
  const completion = await openai.chat.completions.create({
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

  let categoryResponse = (completion.choices?.[0]?.message?.content ?? '').trim();
  console.log('Category response from OpenAI:', categoryResponse);
  if (!TUTORIAL_CATEGORIES.includes(categoryResponse)) {
    console.log('Attempting to find category in response');
    categoryResponse = TUTORIAL_CATEGORIES.find(cat => categoryResponse.includes(cat)) || TUTORIAL_CATEGORIES[0];
  }
  return categoryResponse;
};

// Get recommended tutorials based on user preferences and completed tutorials
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

// Get tutorials with filtering and pagination
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
    
    if (difficulty) {
      constraints.push(where('difficulty', '==', difficulty));
    }
    constraints.push(orderBy(sortField, sortDirection));
    
    const tutorialQuery = query(tutorialsRef, ...constraints);
    const snapshot = await getDocs(tutorialQuery);
    
    const lowerBound = (page - 1) * limitVal;
    const upperBound = lowerBound + limitVal;
    const docs = snapshot.docs.slice(lowerBound, upperBound);
    
    let tutorials = docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Tutorial[];

    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      tutorials = tutorials.filter(t =>
        t.title.toLowerCase().includes(queryLower) ||
        t.content.toLowerCase().includes(queryLower) ||
        t.category.toLowerCase().includes(queryLower)
      );
    }

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