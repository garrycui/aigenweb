import { db } from './firebase';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface ReviewData {
  rating: number;
  feedback?: string;
  platform?: 'ios' | 'android' | 'web';
  createdAt: Date;
}

export const shouldShowReview = async (userId: string): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    if (!userData) return false;

    // Check if user has already reviewed
    if (userData.hasReviewed) return false;

    // Check if user has been active for at least 3 days
    const createdAt = userData.createdAt?.toDate();
    if (!createdAt) return false;

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    return createdAt < threeDaysAgo;
  } catch (error) {
    console.error('Error checking review status:', error);
    return false;
  }
};

export const saveReview = async (userId: string, data: Omit<ReviewData, 'createdAt'>) => {
  try {
    const reviewRef = doc(db, 'reviews', userId);
    await setDoc(reviewRef, {
      ...data,
      createdAt: serverTimestamp()
    });

    // Mark user as having reviewed
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