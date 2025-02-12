import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export const generateChatResponse = async (
  message: string,
  userId: string,
  chatHistory: any[] = [],
  mbtiType?: string,
  aiPreference?: string
) => {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an AI adaptation coach helping users with MBTI type ${mbtiType || 'unknown'} who are ${aiPreference || 'learning about'} AI. Provide personalized guidance and support.`
        },
        ...chatHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        {
          role: 'user',
          content: message
        }
      ]
    });

    const response = completion.choices[0].message?.content;
    if (!response) {
      throw new Error('No response generated');
    }

    return { response };
  } catch (error) {
    console.error('Error generating chat response:', error);
    throw error;
  }
};

export const getResourceRecommendations = async (
  userId: string,
  message: string,
  mbtiType?: string,
  aiPreference?: string
) => {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a resource recommendation system for an AI adaptation platform. The user has MBTI type ${mbtiType || 'unknown'} and is ${aiPreference || 'learning about'} AI.`
        },
        {
          role: 'user',
          content: `Based on the message: "${message}", recommend relevant resources and tutorials.`
        }
      ]
    });

    const response = completion.choices[0].message?.content;
    if (!response) {
      throw new Error('No recommendations generated');
    }

    return {
      posts: [
        {
          id: '1',
          title: 'Getting Started with AI Tools',
          content: 'A beginner-friendly guide to essential AI tools...'
        },
        {
          id: '2',
          title: 'AI Productivity Tips',
          content: 'Learn how to boost your productivity with AI...'
        }
      ]
    };
  } catch (error) {
    console.error('Error getting recommendations:', error);
    throw error;
  }
};