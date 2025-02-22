import OpenAI from 'openai';
import { config } from 'dotenv';
import { fetchTrendingTopics } from './trendingTopics.ts';
import { fetchYouTubeVideos, rankVideos } from './youtubeData.ts';
import { getPexelsImage } from './imageAPI.ts';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

config();

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export interface ContentCategory {
  id: string;
  name: string;
  description: string;
  searchQueries: string[];
  // 'both' means we'll fetch both a video and a post card image.
  preferredMediaType: 'both' | 'video' | 'image';
}

// Full set of production-ready content categories:
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

export interface Source {
  title: string;
  url: string;
  snippet: string;
  type: 'video';
  videoId: string;
}

export interface GeneratedContent {
  title: string;
  content: string;
  category: string;
  source: Source;
  videoUrl: string;
  imageUrl: string;
}

export const generateContent = async (category: ContentCategory): Promise<GeneratedContent[]> => {
  try {
    console.log(`Generating content for category: ${category.name}`);
    
    // Select a random search query from the category's search queries.
    const randomQuery = category.searchQueries[Math.floor(Math.random() * category.searchQueries.length)];
    console.log(`Selected random query: ${randomQuery}`);
    
    // Use the random search query to fetch trending topics.
    const trendingTopics = await fetchTrendingTopics(randomQuery);
    
    const generatedContents: GeneratedContent[] = [];

    for (const trendingQuery of trendingTopics) {
      console.log(`Processing trending query: ${trendingQuery}`);
      
      // Use the trending query to fetch YouTube videos.
      const videos = await fetchYouTubeVideos(trendingQuery, 5);
      if (videos.length === 0) {
        console.log(`No YouTube videos found for query: ${trendingQuery}`);
        continue;
      }
      
      const rankedVideos = rankVideos(videos);
      const topVideo = rankedVideos[0];

      const source: Source = {
        title: topVideo.title,
        url: topVideo.url,
        snippet: topVideo.snippet,
        type: 'video',
        videoId: topVideo.videoId
      };

      // We no longer fetch an image for the final article text, 
      // but we still store an image in the DB if you want a post card.
      const pexelsImages = await getPexelsImage(trendingQuery);
      const imageUrl = pexelsImages.length > 0 ? pexelsImages[0] : '';

      // Generate content using GPT-4o with a refined prompt.
      // The prompt instructs GPT to produce a short, strictly formatted Markdown article,
      // focusing on the YouTube video (no images or raw URLs in the text).
      const prompt = `
        You are an AI content writer. Produce a very short, user-friendly article in Markdown format.
        Follow this strict layout:
        
        1. # Title
        2. Short introduction paragraph (2-3 sentences)
        3. ## Key Insights
        4. A few bullet points with actionable insights from the video
        5. ## Discussion
        6. A short concluding line or question prompting user engagement
        
        Important rules:
        - Keep it under 200 words total.
        - Do not show any raw URL or embed code in the final text.
        - The main focus is on the YouTube video. Mention it, but do not reveal the URL.
        - Do not mention or show the image in the text.
        
        Video Info:
        - Title: ${topVideo.title}
        - Description: ${topVideo.snippet}
        - The video is about: "${trendingQuery}"
        - We are discussing: "${category.description}"
      `;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert content writer focusing on AI topics. The user wants a very short, strictly formatted Markdown article about a single YouTube video, no images or raw URLs.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const response = completion.choices[0].message?.content;
      if (!response) {
        throw new Error('Failed to generate content');
      }

      // We parse out a 'Title:' line if GPT includes one. 
      // Otherwise, we just keep the entire markdown as 'content'.
      let title = topVideo.title; // default fallback
      let content = response;

      // If GPT includes a top line with "# " for title, we can parse it:
      const lines = response.split('\n');
      if (lines[0].startsWith('# ')) {
        // The first line might be "# Some Title"
        title = lines[0].replace(/^# /, '').trim();
        // Reconstruct the rest
        content = lines.slice(1).join('\n');
      }

      generatedContents.push({
        title,
        content,
        category: category.name,
        source,
        videoUrl: `https://www.youtube.com/embed/${topVideo.videoId}`,
        imageUrl
      });

      // For brevity, we only produce 3 articles max per call
      if (generatedContents.length >= 3) {
        break;
      }
    }

    if (generatedContents.length < 1) {
      throw new Error('No suitable content generated.');
    }

    return generatedContents;
  } catch (error) {
    console.error('Error generating content:', error);
    throw error;
  }
};

export const publishContent = async (content: GeneratedContent, userId: string): Promise<string> => {
  try {
    const postRef = await addDoc(collection(getFirestore(), 'posts'), {
      title: content.title,
      content: content.content,
      category: content.category,
      video_url: content.videoUrl,
      image_url: content.imageUrl,
      source: content.source,
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
