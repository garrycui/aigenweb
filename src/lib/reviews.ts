import { db } from './firebase';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection } from 'firebase/firestore';

interface ReviewData {
  rating: number;
  usabilityRating?: number;
  contentRating?: number;
  mostValuedFeature?: string;
  biggestChallenge?: string;
  generalFeedback?: string;
  featureSuggestion?: string;
  platform?: 'ios' | 'android' | 'web';
  createdAt: Date;
}

export const shouldShowReview = async (userId: string, forceShow: boolean = false): Promise<boolean> => {
  // If testing mode is enabled, bypass all checks
  if (forceShow) return true;
  
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    if (!userData) return false;

    // Check if user has already reviewed
    if (userData.hasReviewed) return false;

    // Check if user has dismissed the review recently (within 7 days)
    if (userData.reviewDismissedAt) {
      const dismissedAt = userData.reviewDismissedAt.toDate();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      if (dismissedAt > sevenDaysAgo) {
        return false; // Don't show if dismissed within last 7 days
      }
    }

    // Check if user has been active for at least 3 days
    const createdAt = userData.createdAt?.toDate();
    if (!createdAt) return false;

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Basic time-based condition
    const isOldEnough = createdAt < threeDaysAgo;
    
    // Additional engagement-based condition - tutorials
    const hasCompletedTutorials = (userData.completedTutorials?.length || 0) >= 2;
    
    // Comment out activity tracking since it's not implemented yet
    // const hasUsedApp = userData.lastActivityAt || false;
    
    // Only check account age and tutorial completion for now
    return isOldEnough && hasCompletedTutorials;
  } catch (error) {
    console.error('Error checking review status:', error);
    return false;
  }
};

// Add new function to check if it's time for a periodic review
export const shouldShowPeriodicReview = async (userId: string): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    if (!userData) return false;

    // User must have completed at least one review already
    if (!userData.hasReviewed || !userData.lastReviewedAt) return false;

    const lastReviewDate = userData.lastReviewedAt.toDate();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 1);

    // Check if it's been at least 1 months since the last review
    return lastReviewDate < threeMonthsAgo;
  } catch (error) {
    console.error('Error checking periodic review status:', error);
    return false;
  }
};

// Update saveReview to handle periodic reviews
export const saveReview = async (userId: string, data: Omit<ReviewData, 'createdAt'>, isPeriodic = false) => {
  try {
    // For periodic reviews, use a timestamp-based ID to keep history
    let reviewRef;
    
    if (isPeriodic) {
      const reviewsCollection = collection(db, 'users', userId, 'reviewHistory');
      reviewRef = doc(reviewsCollection); // Auto-generate ID
    } else {
      reviewRef = doc(db, 'reviews', userId);
    }
    
    await setDoc(reviewRef, {
      ...data,
      createdAt: serverTimestamp()
    });

    // Update user document
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      hasReviewed: true,
      lastReviewedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Error saving review:', error);
    throw error;
  }
};

export const getStoreReviewUrl = (platform: 'ios' | 'android'): string => {
  return platform === 'ios'
    ? 'https://apps.apple.com/app/id[YOUR_APP_ID]?action=write-review'
    : 'https://play.google.com/store/apps/details?id=[YOUR_APP_ID]';
};