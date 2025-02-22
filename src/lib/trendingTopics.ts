import OpenAI from 'openai';
import { config } from 'dotenv';

config();

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

/**
 * Uses OpenAI API to fetch very specific, current trending topics (real events/news)
 * in the AI domain for a given query.
 * The prompt instructs OpenAI to return a plain text list of topics.
 */
export async function fetchTrendingTopics(query: string): Promise<string[]> {
  const prompt = `
    You are an AI assistant that provides up-to-date news and events in the AI industry.
    Provide a plain text list of the latest, very specific trending events or news headlines 
    in the AI industry related to "${query}". Each entry should be a real, verifiable event or news item.
    Ensure the topics are current, relevant, and specific to the AI industry.
    Return each topic on a new line without any additional text or formatting. Do not return - or ". 
  `;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that provides up-to-date AI news headlines.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    // Expect OpenAI to respond with a plain text list of topics, e.g., 'Headline 1\nHeadline 2\n...'
    const content = completion.choices[0].message?.content;
    let topics: string[] = [];
    if (content) {
      topics = content.split('\n').map(topic => topic.trim()).filter(topic => topic.length > 0);
    } else {
      console.error('No content received in the response.');
    }
    return topics;
  } catch (error) {
    console.error('Error fetching trending topics via OpenAI API:', error);
    return [];
  }
}
