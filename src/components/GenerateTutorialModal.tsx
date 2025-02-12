import React, { useState } from 'react';
import { X, Loader } from 'lucide-react';
import { generateTutorial } from '../lib/tutorials';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface GenerateTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GenerateTutorialModal: React.FC<GenerateTutorialModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!user || !query.trim()) return;

    try {
      setIsGenerating(true);
      setError(null);
      const tutorial = await generateTutorial(user.id, query);
      onClose();
      navigate(`/tutorials/${tutorial.id}`);
    } catch (error) {
      console.error('Error generating tutorial:', error);
      setError('Failed to generate tutorial. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto">
          <div className="absolute right-4 top-4">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Generate Custom Tutorial
            </h2>
            
            <p className="text-gray-600 mb-6">
              What would you like to learn about? We'll create a personalized tutorial based on your learning style and preferences.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What do you want to learn?
              </label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="E.g., How to use ChatGPT for email management, or How to implement AI in my daily workflow..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={4}
                required
              />
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !query.trim()}
                className={`px-6 py-2 bg-indigo-600 text-white rounded-lg transition-colors ${
                  isGenerating || !query.trim() ? 'bg-indigo-400 cursor-not-allowed' : 'hover:bg-indigo-700'
                }`}
              >
                {isGenerating ? (
                  <span className="flex items-center">
                    <Loader className="animate-spin -ml-1 mr-3 h-5 w-5" />
                    Generating Tutorial...
                  </span>
                ) : (
                  'Generate Tutorial'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerateTutorialModal;