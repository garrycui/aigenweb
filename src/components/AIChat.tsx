import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { generateChatResponse, getResourceRecommendations } from '../lib/openai';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Resource {
  id: string;
  title: string;
  type: 'post' | 'lesson';
  description?: string;
  link: string;
}

const AIChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    const userMessage = input;
    setInput('');
    setIsLoading(true);

    // Add user message immediately
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }]);

    try {
      // Get ChatGPT response
      const { response } = await generateChatResponse(
        userMessage,
        user.id,
        user.mbtiType,
        user.aiPreference
      );

      // Get relevant resources
      const recommendations = await getResourceRecommendations(
        user.id,
        userMessage,
        user.mbtiType,
        user.aiPreference
      );

      // Add assistant response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response,
        timestamp: new Date()
      }]);

      // Update recommended resources
      if (recommendations.posts.length > 0) {
        setResources(recommendations.posts.map(post => ({
          id: post.id,
          title: post.title,
          type: 'post',
          description: post.content.substring(0, 100) + '...',
          link: `/forum/${post.id}`
        })));
      }
    } catch (error) {
      console.error('Error in chat:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-lg shadow-md">
      {/* Chat Header */}
      <div className="flex items-center space-x-2 p-4 border-b">
        <Bot className="h-6 w-6 text-indigo-600" />
        <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p className="text-sm">{message.content}</p>
              <span className="text-xs opacity-75 mt-1 block">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Resources Section */}
      {resources.length > 0 && (
        <div className="border-t p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2">
            Recommended Resources
          </h3>
          <div className="space-y-2">
            {resources.map((resource) => (
              <a
                key={resource.id}
                href={resource.link}
                className="block p-2 rounded hover:bg-gray-50 transition-colors"
              >
                <h4 className="text-sm font-medium text-indigo-600">
                  {resource.title}
                </h4>
                {resource.description && (
                  <p className="text-xs text-gray-600 mt-1">
                    {resource.description}
                  </p>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="w-full pl-4 pr-12 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;