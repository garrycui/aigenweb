import OpenAI from 'openai';
import axios from 'axios';
import { config } from 'dotenv';
import { Messages } from 'openai/resources/beta/threads/messages.mjs';

config();

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  type: 'article' | 'video';
  thumbnailUrl?: string;
  videoId?: string;
}

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

// Search using ChatGPT's browsing capability
export const searchWeb = async (query: string, limit: number = 3): Promise<SearchResult[]> => {
  try {

    const messages = [
      {
        role: 'system',
        content: 'You are a web search assistant. Search for relevant content and return both articles and videos.'
      },
      {
        role: 'user',
        content: `Search for: ${query}\nFind ${limit} most relevant results including both articles and YouTube videos. Format as JSON array with fields: title, url, snippet, type (article/video), thumbnailUrl (for videos), videoId (YouTube ID for videos).`
      }
    ];
    
    // Print out the messages
    console.log('Messages:', messages);
    
    // First, use ChatGPT to search for relevant content
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a web search assistant. Search for relevant content and return both articles and videos.'
        },
        {
          role: 'user',
          content: `Search for: ${query}\nFind ${limit} most relevant results including both articles and YouTube videos. Format as JSON array with fields: title, url, snippet, type (article/video), thumbnailUrl (for videos), videoId (YouTube ID for videos).`
        }
      ]
    });

    const response = completion.choices[0].message?.content;
    if (!response) {
      throw new Error('No search results found');
    }

    const results: SearchResult[] = JSON.parse(response);
    console.log('Search results:', results);

    // Validate and process YouTube video URLs
    return results.map(result => {
      if (result.type === 'video') {
        const videoId = extractYouTubeId(result.url);
        if (videoId) {
          return {
            ...result,
            videoId,
            // Use the proper embed URL format with additional parameters
            url: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=0`
          };
        }
      }
      return result;
    });
  } catch (error) {
    console.error('Error searching web:', error);
    throw error;
  }
};

// Extract YouTube video ID from various URL formats
const extractYouTubeId = (url: string): string => {
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
    /^[a-zA-Z0-9_-]{11}$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return '';
};

// Get image suggestions from Unsplash
export const getImageSuggestions = async (query: string): Promise<string[]> => {
  try {
    const response = await axios.get(`https://api.unsplash.com/search/photos`, {
      params: {
        query,
        per_page: 5,
        client_id: process.env.VITE_UNSPLASH_ACCESS_KEY
      }
    });

    return response.data.results.map((img: any) => img.urls.regular);
  } catch (error) {
    console.error('Error fetching images:', error);
    return [];
  }
};