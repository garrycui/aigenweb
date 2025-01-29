import React, { useState } from 'react';
import { Search, Bot } from 'lucide-react';

type Resource = {
  title: string;
  description: string;
  type: 'article' | 'video' | 'course';
  link: string;
};

const ChatGptQA = ({ type }: { type: 'forum' | 'resources' }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [suggestedResources, setSuggestedResources] = useState<Resource[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulated API response - In a real app, this would call the ChatGPT API
    setTimeout(() => {
      if (type === 'forum') {
        setResponse(
          "Based on your interest in AI productivity tools, I recommend checking out Sarah Chen's post about improving productivity by 50% using AI tools. You might also find Michael Rodriguez's discussion about managing AI anxiety in the workplace helpful."
        );
        setSuggestedResources([
          {
            title: "How I leveraged AI to improve my productivity by 50%",
            description: "A detailed journey of implementing AI tools for task automation",
            type: 'article',
            link: '/forum/1'
          },
          {
            title: "Dealing with AI anxiety in the workplace",
            description: "Strategies for overcoming fears about AI adoption",
            type: 'article',
            link: '/forum/2'
          }
        ]);
      } else {
        setResponse(
          "Here are some recommended resources about AI productivity tools and workplace integration:"
        );
        setSuggestedResources([
          {
            title: "Introduction to AI Productivity Tools",
            description: "Learn the basics of AI-powered productivity enhancement",
            type: 'course',
            link: '#'
          },
          {
            title: "AI Integration Best Practices",
            description: "A comprehensive guide to implementing AI in your workflow",
            type: 'video',
            link: '#'
          }
        ]);
      }
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <div className="flex items-center space-x-2 mb-4">
        <Bot className="h-6 w-6 text-indigo-600" />
        <h2 className="text-lg font-semibold text-gray-900">
          AI Assistant
        </h2>
      </div>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Ask about ${type === 'forum' ? 'community discussions' : 'learning resources'}...`}
            className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-indigo-600"
            disabled={isLoading}
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
      </form>

      {isLoading && (
        <div className="flex justify-center items-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      )}

      {response && (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-700">{response}</p>
          </div>

          {suggestedResources.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Suggested {type === 'forum' ? 'Posts' : 'Resources'}</h3>
              <div className="space-y-3">
                {suggestedResources.map((resource, index) => (
                  <a
                    key={index}
                    href={resource.link}
                    className="block p-4 border border-gray-200 rounded-lg hover:border-indigo-500 transition-colors"
                  >
                    <h4 className="font-medium text-indigo-600 mb-1">{resource.title}</h4>
                    <p className="text-sm text-gray-600">{resource.description}</p>
                    <span className="inline-block mt-2 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {resource.type}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatGptQA;