import { db } from './firebase';
import { doc, getDoc, updateDoc, increment, collection, query, where, getDocs, Timestamp, setDoc } from 'firebase/firestore';
import { getUser, updateUser, tutorialCache, invalidateUserCache } from './cache'; // Import user service functions

interface MonthlyProgress {
  month: string;
  completedTutorials: number;
  forumPosts: number;
  goalsProgress: number;
  totalImprovement: number;
}

export const calculateMonthlyImprovement = async (userId: string): Promise<number> => {
  try {
    const userData = await getUser(userId); // Use getUser instead of direct Firestore
    if (!userData) return 0;

    // Get current and previous month's data
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM format
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1)
      .toISOString()
      .slice(0, 7);

    // Get monthly progress records
    const progressRef = collection(db, 'users', userId, 'monthlyProgress');
    const currentMonthQuery = query(
      progressRef,
      where('month', '==', currentMonth)
    );
    const lastMonthQuery = query(
      progressRef,
      where('month', '==', lastMonth)
    );

    const [currentMonthDocs, lastMonthDocs] = await Promise.all([
      getDocs(currentMonthQuery),
      getDocs(lastMonthQuery)
    ]);

    const currentMonthData = currentMonthDocs.docs[0]?.data() as MonthlyProgress;
    const lastMonthData = lastMonthDocs.docs[0]?.data() as MonthlyProgress;

    if (!lastMonthData) return 0;

    // Calculate improvement percentage
    const improvement = ((currentMonthData?.totalImprovement || 0) - lastMonthData.totalImprovement) / 
                       lastMonthData.totalImprovement * 100;

    return Math.round(improvement);
  } catch (error) {
    console.error('Error calculating monthly improvement:', error);
    return 0;
  }
};

export const updateUserProgress = async (userId: string, type: 'tutorial' | 'post' | 'goal') => {
  try {
    // Get current counts from user data
    const userData = await getUser(userId);
    if (!userData) return;
    
    // Prepare updates using userData
    const updates: any = {};
    if (type === 'tutorial') {
      const currentCount = userData.completedTutorialsCount || 0;
      updates.completedTutorialsCount = currentCount + 1;
    } else if (type === 'post') {
      const currentCount = userData.publishedPostsCount || 0;
      updates.publishedPostsCount = currentCount + 1;
    } else if (type === 'goal') {
      const currentCount = userData.completedGoalsCount || 0;
      updates.completedGoalsCount = currentCount + 1;
    }
    
    // Update user with new counts
    await updateUser(userId, updates);

    // The monthly progress subcollection needs to handle document creation
    const month = new Date().toISOString().slice(0, 7);
    const progressRef = doc(db, 'users', userId, 'monthlyProgress', month);

    // Check if the document exists first
    const progressDoc = await getDoc(progressRef);
    
    if (!progressDoc.exists()) {
      // Document doesn't exist - create it instead of updating
      await setDoc(progressRef, {
        month,
        completedTutorials: type === 'tutorial' ? 1 : 0,
        forumPosts: type === 'post' ? 1 : 0,
        goalsProgress: type === 'goal' ? 1 : 0,
        totalImprovement: 1,
        updatedAt: Timestamp.now()
      });
    } else {
      // Document exists - update it
      const updates: any = {
        updatedAt: Timestamp.now(),
        totalImprovement: increment(1)
      };
      if (type === 'tutorial') updates.completedTutorials = increment(1);
      if (type === 'post') updates.forumPosts = increment(1);
      if (type === 'goal') updates.goalsProgress = increment(1);
      await updateDoc(progressRef, updates);
    }
  } catch (error) {
    console.error('Error updating user progress:', error);
    throw error;
  }
};

export const markTutorialComplete = async (userId: string, tutorialId: string) => {
  try {
    // Get existing completedTutorials
    const userData = await getUser(userId);
    if (!userData) return;
    
    // Prepare the complete list including the new one
    const completedTutorials = [...(userData.completedTutorials || [])];
    if (!completedTutorials.includes(tutorialId)) {
      completedTutorials.push(tutorialId);
      
      // Update the user document
      await updateUser(userId, { completedTutorials });
      
      // Update progress
      await updateUserProgress(userId, 'tutorial');
      
      // Invalidate all relevant caches
      invalidateUserCache(userId); // This will clear all user-related caches
      
      // Clear recommended tutorials cache which is based on completed tutorials
      const recommendedCacheKeys = tutorialCache.keys().filter(key => 
        key.includes(`recommended-tutorials-${userId}`)
      );
      recommendedCacheKeys.forEach(key => tutorialCache.delete(key));
      
      console.log('Cache invalidated for completed tutorial', tutorialId);
    }
  } catch (error) {
    console.error('Error marking tutorial complete:', error);
    throw error;
  }
};