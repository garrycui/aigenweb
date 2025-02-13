import { db } from './firebase';
import { doc, getDoc, updateDoc, increment, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

interface MonthlyProgress {
  month: string;
  completedTutorials: number;
  forumPosts: number;
  goalsProgress: number;
  totalImprovement: number;
}

export const calculateMonthlyImprovement = async (userId: string): Promise<number> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

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
    const userRef = doc(db, 'users', userId);
    const month = new Date().toISOString().slice(0, 7);
    const progressRef = doc(db, 'users', userId, 'monthlyProgress', month);

    // Update user document
    const updates: any = {};
    if (type === 'tutorial') {
      updates.completedTutorialsCount = increment(1);
    } else if (type === 'post') {
      updates.publishedPostsCount = increment(1);
    } else if (type === 'goal') {
      updates.completedGoalsCount = increment(1);
    }
    await updateDoc(userRef, updates);

    // Update monthly progress
    const progressDoc = await getDoc(progressRef);
    if (!progressDoc.exists()) {
      await updateDoc(progressRef, {
        month,
        completedTutorials: type === 'tutorial' ? 1 : 0,
        forumPosts: type === 'post' ? 1 : 0,
        goalsProgress: type === 'goal' ? 1 : 0,
        totalImprovement: 1,
        updatedAt: Timestamp.now()
      });
    } else {
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
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      completedTutorials: arrayUnion(tutorialId)
    });
    await updateUserProgress(userId, 'tutorial');
  } catch (error) {
    console.error('Error marking tutorial complete:', error);
    throw error;
  }
};