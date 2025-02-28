import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { processChatMessage, getChatHistory } from '../lib/chat';
import AIChatCard from './AIChatCard';

const AIChat = () => {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{
    content: string;
    role: 'user' | 'assistant';
    sentiment?: 'positive' | 'negative' | 'neutral';
    timestamp?: string;
    recommendations?: { id: string; title: string; content: string; type?: 'post' | 'tutorial' }[];
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState('min-h-[60px]');
  const [isThinking, setIsThinking] = useState(false);

  // Load chat history when component mounts
  useEffect(() => {
    if (user) {
      setIsLoading(true);
      getChatHistory(user.id)
        .then(history => {
          if (history.length > 0) {
            setContainerHeight('h-[400px]');
            const formattedMessages = history.map(msg => ({
              content: msg.content.replace(/\n/g, '<br/>'),
              role: msg.role,
              sentiment: msg.sentiment,
              timestamp: msg.timestamp
            }));
            setMessages(formattedMessages);
          }
        })
        .catch(error => {
          console.error('Error loading chat history:', error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [user]);

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

    // Show user message immediately
    setMessages(prev => [...prev, { content: message, role: 'user', timestamp }]);
    
    // Add a small delay and show thinking indicator to make it feel more human
    setTimeout(() => setIsThinking(true), 500);

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
      setIsThinking(false);
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

  // Handler for content card clicks
  const handleContentClick = (id: string, type: 'post' | 'tutorial') => {
    const path = type === 'post' ? `/forum/${id}` : `/tutorials/${id}`;
    window.location.href = path;
  };

  return (
    <div className={`flex flex-col bg-gray-50 rounded-lg transition-all duration-300 ${containerHeight}`}>
      {/* Chat Display */}
      <div 
        ref={chatContainerRef}
        className="flex-1 p-4 overflow-y-auto space-y-4"
      >
        {/* Welcome message when no messages */}
        {messages.length === 0 && !isLoading && (
          <div className="flex justify-center items-center h-full">
            <div className="text-center p-6 rounded-lg bg-white shadow-sm border border-gray-200">
              <h3 className="font-medium text-gray-800 mb-2">Welcome! I'm here to help you.</h3>
              <p className="text-gray-600 text-sm mb-4">How are you feeling about AI technology today?</p>
              <div className="flex justify-center space-x-2">
                <button 
                  onClick={() => setInput("I'm excited about AI possibilities!")}
                  className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200"
                >
                  Excited
                </button>
                <button 
                  onClick={() => setInput("I'm a bit uncertain about AI changes.")}
                  className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200"
                >
                  Uncertain
                </button>
                <button 
                  onClick={() => setInput("I want to learn more about AI.")}
                  className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200"
                >
                  Curious
                </button>
              </div>
            </div>
          </div>
        )}

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
              <div className="mt-4 space-y-4 w-full max-w-[95%]">
                {message.recommendations.map(rec => (
                  <AIChatCard
                    key={rec.id}
                    item={{
                      id: rec.id,
                      title: rec.title,
                      content: rec.content,
                      type: rec.type || 'tutorial' // Default to tutorial if type not specified
                    }}
                    onClick={handleContentClick}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Enhanced thinking indicator with animated gradient */}
        {(isLoading || isThinking) && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 shadow-sm">
              <div className="flex flex-col space-y-1">
                <div className="flex space-x-2 items-center">
                  <div className="thinking-dot bg-indigo-400 rounded-full animate-thinking-1"></div>
                  <div className="thinking-dot bg-indigo-500 rounded-full animate-thinking-2"></div>
                  <div className="thinking-dot bg-indigo-600 rounded-full animate-thinking-3"></div>
                </div>
                <span className="text-xs text-gray-500 pt-1">AI is thinking...</span>
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

      {/* Add custom CSS for thinking animation */}
      <style>{`
        .thinking-dot {
          width: 8px;
          height: 8px;
          opacity: 0.7;
        }

        @keyframes thinking {
          0% { transform: translateY(0px); opacity: 0.4; }
          50% { transform: translateY(-5px); opacity: 1; }
          100% { transform: translateY(0px); opacity: 0.4; }
        }

        .animate-thinking-1 {
          animation: thinking 1.2s infinite;
        }
        
        .animate-thinking-2 {
          animation: thinking 1.2s infinite 0.2s;
        }
        
        .animate-thinking-3 {
          animation: thinking 1.2s infinite 0.4s;
        }
        
        .animate-fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AIChat;
