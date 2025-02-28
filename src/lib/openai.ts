import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

// Helper function to retrieve communication style based on MBTI type
const getCommunicationStyle = (mbtiType: string): string => {
  const styles: { [key: string]: string } = {
    ENTJ: 'Be direct and results-oriented, focusing on goals and efficiency.',
    ENFJ: 'Use empathetic and supportive language, emphasizing collaboration.',
    ESTJ: 'Provide clear, structured information with practical applications.',
    ESFJ: 'Engage warmly, focusing on harmony and personal connections.',
    ENTP: 'Encourage exploration of ideas with an open and enthusiastic tone.',
    ENFP: 'Be enthusiastic and imaginative, supporting their creative pursuits.',
    ESTP: 'Keep communication dynamic and action-oriented, focusing on the present.',
    ESFP: 'Use lively and expressive language, emphasizing experiences and fun.',
    INTJ: 'Communicate with strategic and insightful language, focusing on concepts.',
    INFJ: 'Be compassionate and deep, encouraging meaningful discussions.',
    ISTJ: 'Provide detailed and factual information in a straightforward manner.',
    ISFJ: 'Use considerate and gentle language, focusing on stability and support.',
    INTP: 'Engage in logical analysis, encouraging independent thought.',
    INFP: 'Be sincere and reflective, supporting their values and ideals.',
    ISTP: 'Keep communication concise and practical, focusing on problem-solving.',
    ISFP: 'Use kind and flexible language, emphasizing personal values and experiences.'
  };
  return styles[mbtiType] || 'Use a balanced and adaptable communication style.';
};

// Helper function to retrieve communication strategy based on AI preference
const getAIPreferenceStrategy = (aiPreference: string): string => {
  const strategies: { [key: string]: string } = {
    enthusiastic: 'Encourage their passion for AI by providing advanced insights and opportunities for deeper engagement.',
    optimistic: 'Highlight the benefits of AI and suggest practical ways to integrate it into their interests.',
    cautious: 'Acknowledge their concerns about AI, providing balanced information and emphasizing safety measures.',
    resistant: 'Address their skepticism by building trust, offering clear explanations, and alleviating fears.'
  };
  return strategies[aiPreference] || 'Maintain a neutral and informative approach to AI topics.';
};

const formatMessage = (role: 'system' | 'user' | 'assistant', content: string) => ({
  role,
  content
});

const formatResponse = (response: string): string => {
  // Add line breaks and paragraph breaks for better readability
  const paragraphs = response.split('\n').map(paragraph => paragraph.trim()).filter(paragraph => paragraph.length > 0);
  const formattedParagraphs = [];
  let currentParagraph = '';

  paragraphs.forEach((paragraph, index) => {
    if (paragraph.startsWith('•')) {
      if (index % 2 === 0 && currentParagraph) {
        formattedParagraphs.push(currentParagraph);
        currentParagraph = '';
      }
    }
    currentParagraph += `${paragraph}\n`;
  });

  if (currentParagraph) {
    formattedParagraphs.push(currentParagraph);
  }

  return formattedParagraphs.join('\n\n');
};

export const generateChatResponse = async (
  message: string,
  chatHistory: any[] = [],
  mbtiType?: string,
  aiPreference?: string
) => {
  try {
    // Define the chatbot's persona and objectives with the new empowering, questioning approach
    const persona = `You are an empathetic AI coach who listens carefully and asks thoughtful questions. 
Your main goals are to:
1. Keep your responses brief and concise (2-3 short paragraphs maximum)
2. Ask at least one follow-up question in EVERY response to deepen understanding
3. Create an empowering and positive conversation experience
4. Gather information about the user's challenges, goals, and needs
5. Identify moments to recommend relevant learning resources naturally
6. Help users adapt to the AI era by building their confidence

When the user might benefit from learning resources, mention that you have helpful tutorials/guides available,
but do so conversationally rather than immediately listing them.`;

    // Adjust communication style based on MBTI type
    const communicationStyle = mbtiType ? getCommunicationStyle(mbtiType) : '';

    // Adjust communication strategy based on AI preference
    const aiStrategy = aiPreference ? getAIPreferenceStrategy(aiPreference) : '';

    // Construct the system message
    const systemMessage = `${persona} ${communicationStyle} ${aiStrategy}`;

    // Prepare the messages for the API call
    const messages = [
      formatMessage('system', systemMessage),
      ...chatHistory.map(msg => formatMessage(msg.role as 'user' | 'assistant', msg.content)),
      formatMessage('user', message)
    ];

    // Call the OpenAI API to generate a response
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages
    });

    let response = completion.choices[0].message?.content;
    if (!response) {
      throw new Error('No response generated');
    }

    // Format the response
    response = formatResponse(response);

    return { response };
  } catch (error) {
    console.error('Error generating chat response:', error);
    throw error;
  }
};

export const extractKeyword = async (message: string): Promise<string> => {
  if (!message || typeof message !== "string") return "";

  const prompt = `
    Extract the most relevant single keyword from the following search phrase.
    Do not return multiple words, only the most important keyword related to the search.
    If no relevant keyword exists, return an empty string.

    Search Phrase: "${message}"
    Keyword:
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt }
      ],
      max_tokens: 10
    });

    const keyword = response.choices[0].message?.content?.trim() || "";
    return keyword;
  } catch (error) {
    console.error("Error extracting keyword:", error);
    return "";
  }
};