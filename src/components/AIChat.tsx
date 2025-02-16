import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { processChatMessage } from '../lib/chat';
import TutorialCard from './TutorialCard'; // Import the TutorialCard component

const AIChat = () => {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{
    content: string;
    role: 'user' | 'assistant';
    sentiment?: 'positive' | 'negative' | 'neutral';
    timestamp?: string;
    recommendations?: { id: string; title: string; content: string }[];
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState('min-h-[60px]');

  useEffect(() => {
    if (messages.length > 0) {
      setContainerHeight('h-[400px]');
    }
  }, [messages]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || isLoading) return;

    const timestamp = new Date().toISOString();
    const message = input;
    setInput('');
    setIsLoading(true);

    setMessages(prev => [...prev, { content: message, role: 'user', timestamp }]);

    try {
      const result = await processChatMessage(user.id, message);
      const responses = Array.isArray(result) ? result : [result];
      
      const newMessages = responses.map((res) => ({
        content: res.response.replace(/\n/g, '<br/>'),
        role: 'assistant' as 'assistant',
        sentiment: res.sentiment,
        timestamp: new Date().toISOString(),
        recommendations: res.recommendations || []
      }));

      setMessages(prev => {
        const updatedMessages = [...prev];
        if (updatedMessages.length > 0) {
          updatedMessages[updatedMessages.length - 1] = { content: message, role: 'user', timestamp };
        } else {
          updatedMessages.push({ content: message, role: 'user', timestamp });
        }
        return [...updatedMessages, ...newMessages];
      });
    } catch (error) {
      console.error('Error in chat:', error);
      setMessages(prev => [
        ...prev,
        { content: 'I apologize, but I encountered an error. Please try again.', role: 'assistant', timestamp: new Date().toISOString() }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-50 border-green-200';
      case 'negative': return 'bg-red-50 border-red-200';
      case 'neutral': return 'bg-blue-50 border-blue-200';
      default: return 'bg-white border-gray-200';
    }
  };

  return (
    <div className={`flex flex-col bg-gray-50 rounded-lg transition-all duration-300 ${containerHeight}`}>
      {/* Chat Display */}
      <div 
        ref={chatContainerRef}
        className="flex-1 p-4 overflow-y-auto space-y-4"
      >
        {messages.map((message, index) => (
          <div 
            key={index} 
            className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}
          >
            <div
              className={`max-w-[80%] p-4 rounded-lg border shadow-sm ${getSentimentColor(message.sentiment)}`}
              dangerouslySetInnerHTML={{ __html: message.content }}
              style={{ whiteSpace: 'pre-wrap' }} // Preserve whitespace
            />
            <span className="text-xs text-gray-500 mt-1">
              {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ''}
            </span>
            {message.recommendations && message.recommendations.length > 0 && (
              <div className="mt-4 space-y-4">
                {message.recommendations.map(rec => (
                  <TutorialCard
                    key={rec.id}
                    tutorial={rec}
                    onClick={() => window.location.href = `/${rec.id}`}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Animated Typing Indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-4">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 bg-white border-t">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..."
            className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full ${
              isLoading || !input.trim()
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-indigo-600 hover:bg-indigo-50'
            }`}
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;
