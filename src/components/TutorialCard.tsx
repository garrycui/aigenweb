import React from 'react';
import { Book, Clock, ThumbsUp, Eye, CheckCircle, Code } from 'lucide-react';
import { Tutorial } from '../lib/tutorials';

interface TutorialCardProps {
  tutorial: Tutorial;
  onClick: (tutorialId: string) => void;
  isCompleted?: boolean;
}

const TutorialCard: React.FC<TutorialCardProps> = ({ tutorial, onClick, isCompleted = false }) => {
  return (
    <div 
      className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow cursor-pointer relative border border-gray-200 overflow-hidden"
      onClick={() => onClick(tutorial.id)}
    >
      {isCompleted && (
        <span className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center z-10">
          <CheckCircle className="h-4 w-4 mr-1" /> Completed
        </span>
      )}
      
      {tutorial.introImageUrl && (
        <div className="relative h-44">
          <img 
            src={tutorial.introImageUrl} 
            alt="Tutorial cover" 
            className="w-full h-full object-cover"
          />
          {tutorial.isCodingTutorial && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded-lg flex items-center text-xs">
              <Code className="h-4 w-4 mr-1" />
              Code Tutorial
            </div>
          )}
        </div>
      )}

      <div className="p-6">
        <div className="flex items-center space-x-2 mb-3">
          <Book className="h-5 w-5 text-indigo-600" />
          <span className="text-sm font-medium text-indigo-600 uppercase tracking-wide">
            {tutorial.category}
          </span>
        </div>

        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
          {tutorial.title}
        </h3>

        <p className="text-gray-700 text-sm mb-4 line-clamp-3">
          {tutorial.sections && tutorial.sections.length > 0 ? tutorial.sections[0].content : tutorial.content}
        </p>

        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>{tutorial.estimatedMinutes} min</span>
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
          <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-xs font-medium">
            {tutorial.difficulty}
          </span>
        </div>

        {tutorial.resources && (tutorial.resources.webLinks.length > 0 || tutorial.resources.videos.length > 0) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-2">Includes:</p>
            <div className="flex space-x-2">
              {tutorial.resources.webLinks.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {tutorial.resources.webLinks.length} Resources
                </span>
              )}
              {tutorial.resources.videos.length > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                  {tutorial.resources.videos.length} Videos
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TutorialCard;