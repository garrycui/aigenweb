import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import { saveReview, getStoreReviewUrl } from '../lib/reviews';
import { useAuth } from '../context/AuthContext';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform?: 'ios' | 'android' | 'web';
}

const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, platform = 'web' }) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  if (!isOpen || !user) return null;

  const handleRatingClick = async (selectedRating: number) => {
    setRating(selectedRating);

    if (selectedRating === 5 && platform !== 'web') {
      // For mobile apps, redirect to store review
      window.location.href = getStoreReviewUrl(platform);
      onClose();
    } else {
      setShowFeedbackForm(true);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    try {
      setIsSubmitting(true);
      await saveReview(user.id, {
        rating,
        feedback,
        platform
      });
      onClose();
    } catch (error) {
      console.error('Error submitting review:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

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
            {!showFeedbackForm ? (
              <>
                <h2 className="text-2xl font-bold text-center text-gray-900 mb-4">
                  Enjoying AI Adapt?
                </h2>
                <p className="text-center text-gray-600 mb-6">
                  We'd love to hear your thoughts! How would you rate your experience?
                </p>
                <div className="flex justify-center space-x-2 mb-6">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      onMouseEnter={() => setHoveredRating(value)}
                      onMouseLeave={() => setHoveredRating(0)}
                      onClick={() => handleRatingClick(value)}
                      className="p-1 focus:outline-none"
                    >
                      <Star
                        className={`h-8 w-8 ${
                          value <= (hoveredRating || rating)
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-center text-gray-900 mb-4">
                  {rating === 5 ? 'Thank You!' : 'Help Us Improve'}
                </h2>
                <p className="text-center text-gray-600 mb-6">
                  {rating === 5
                    ? 'We appreciate your feedback! Would you like to share what you love about AI Adapt?'
                    : 'We value your feedback. Please let us know how we can improve your experience.'}
                </p>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={4}
                />
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className={`px-6 py-2 bg-indigo-600 text-white rounded-lg transition-colors ${
                      isSubmitting ? 'bg-indigo-400 cursor-not-allowed' : 'hover:bg-indigo-700'
                    }`}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;