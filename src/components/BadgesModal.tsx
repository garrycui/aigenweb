import React from 'react';
import { X } from 'lucide-react';
import { Badge } from '../lib/badges';

interface BadgesModalProps {
  isOpen: boolean;
  onClose: () => void;
  badges: Badge[];
}

const BadgesModal: React.FC<BadgesModalProps> = ({ isOpen, onClose, badges }) => {
  if (!isOpen) return null;

  const categories = {
    achievement: 'Achievement Badges',
    learning: 'Learning Badges',
    community: 'Community Badges',
    milestone: 'Milestone Badges'
  };

  const groupedBadges = badges.reduce((acc, badge) => {
    if (!acc[badge.category]) {
      acc[badge.category] = [];
    }
    acc[badge.category].push(badge);
    return acc;
  }, {} as Record<string, Badge[]>);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-auto">
          <div className="absolute right-4 top-4">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Badges</h2>
            
            <div className="space-y-6">
              {Object.entries(categories).map(([category, title]) => (
                <div key={category}>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">{title}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {groupedBadges[category]?.map((badge) => (
                      <div
                        key={badge.id}
                        className="p-4 border border-gray-200 rounded-lg hover:border-indigo-500 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{badge.icon}</span>
                          <div>
                            <h4 className="font-medium text-gray-900">{badge.name}</h4>
                            <p className="text-sm text-gray-600">{badge.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!groupedBadges[category] || groupedBadges[category].length === 0) && (
                      <div className="col-span-full text-center py-4 bg-gray-50 rounded-lg">
                        <p className="text-gray-500">No badges earned in this category yet</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BadgesModal;