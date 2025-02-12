import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { shouldShowReview } from '../lib/reviews';

export const useReviewPrompt = () => {
  const { user } = useAuth();
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    const checkReviewStatus = async () => {
      if (!user) return;

      try {
        const shouldShow = await shouldShowReview(user.id);
        setShowReview(shouldShow);
      } catch (error) {
        console.error('Error checking review status:', error);
      }
    };

    checkReviewStatus();
  }, [user]);

  return {
    showReview,
    setShowReview
  };
};