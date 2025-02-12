import React from 'react';
import { Book, Clock, ThumbsUp, Eye } from 'lucide-react';
import { Tutorial } from '../lib/tutorials';

interface TutorialCardProps {
  tutorial: Tutorial;
  onClick: (tutorialId: string) => void;
}

const TutorialCard: React.FC<TutorialCardProps> = ({ tutorial, onClick }) => {
  return (
    <div 
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => onClick(tutorial.id)}
    >
      <div className="p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Book className="h-5 w-5 text-indigo-600" />
          <span className="text-sm font-medium text-indigo-600">{tutorial.category}</span>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {tutorial.title}
        </h3>

        <p className="text-gray-600 mb-4 line-clamp-2">
          {tutorial.content.split('\n')[0]}
        </p>

        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>{tutorial.estimatedMinutes} min read</span>
            </div>
            <div className="flex items-center">
              <ThumbsUp className="h-4 w-4 mr-1" />
              <span>{tutorial.likes}</span>
            </div>
            <div className="flex items-center">
              <Eye className="h-4 w-4 mr-1" />
              <span>{tutorial.views}</span>
            </div>
          </div>
          <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
            {tutorial.difficulty}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TutorialCard;