import { db } from './firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getLatestAssessment } from './api'; // <-- new import

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'achievement' | 'learning' | 'community' | 'milestone';
  createdAt: Date;
}

export const BADGES = {
  ASSESSMENT_COMPLETE: {
    id: 'assessment_complete',
    name: 'Self-Aware',
    description: 'Completed the AI adaptation assessment',
    icon: '🎯',
    category: 'achievement'
  },
  FIRST_GOAL: {
    id: 'first_goal',
    name: 'Goal Setter',
    description: 'Set your first learning goal',
    icon: '🎯',
    category: 'achievement'
  },
  GOAL_MASTER: {
    id: 'goal_master',
    name: 'Goal Master',
    description: 'Completed all three learning goals',
    icon: '🏆',
    category: 'achievement'
  },
  FIRST_POST: {
    id: 'first_post',
    name: 'Community Voice',
    description: 'Published your first forum post',
    icon: '📝',
    category: 'community'
  },
  TUTORIAL_COMPLETE: {
    id: 'tutorial_complete',
    name: 'Quick Learner',
    description: 'Completed your first tutorial',
    icon: '📚',
    category: 'learning'
  },
  TUTORIAL_MASTER: {
    id: 'tutorial_master',
    name: 'Tutorial Master',
    description: 'Completed 10 tutorials',
    icon: '🎓',
    category: 'learning'
  },
  ENGAGEMENT_STAR: {
    id: 'engagement_star',
    name: 'Engagement Star',
    description: 'Received 50 likes on your posts and comments',
    icon: '⭐',
    category: 'community'
  },
  MILESTONE_30_DAYS: {
    id: 'milestone_30_days',
    name: '30 Days of Growth',
    description: 'Actively learning for 30 days',
    icon: '📅',
    category: 'milestone'
  }
};

// New helper to retrieve badge by its id
const getBadgeById = (badgeId: string) => {
  return Object.values(BADGES).find(badge => badge.id === badgeId);
};

export const awardBadge = async (userId: string, badgeId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) return;
    
    const badges = userDoc.data().badges || [];
    if (badges.includes(badgeId)) return;
    
    await updateDoc(userRef, {
      badges: arrayUnion(badgeId)
    });
    
    return getBadgeById(badgeId);
  } catch (error) {
    console.error('Error awarding badge:', error);
    throw error;
  }
};

export const getUserBadges = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) return [];
    
    const badgeIds = userDoc.data().badges || [];
    return badgeIds.map((id: string) => getBadgeById(id)).filter(Boolean);
  } catch (error) {
    console.error('Error getting user badges:', error);
    throw error;
  }
};

export const checkAndAwardBadges = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) return;
    
    const userData = userDoc.data();
    // New: fetch learning goals from subcollection
    const goalsDoc = await getDoc(doc(db, 'users', userId, 'learningGoals', 'goals'));
    const goals = goalsDoc.exists() ? (goalsDoc.data().goals || []) : [];
    
    // New: fetch assessment if not already set in userData
    let hasAssessment = userData.hasCompletedAssessment;
    if (!hasAssessment) {
      const assessmentResult = await getLatestAssessment(userId);
      hasAssessment = !!assessmentResult.data;
    }
    
    const newBadges: string[] = [];
    
    // Updated condition for Self-Aware badge using progress.assessment logic
    if (hasAssessment) {
      newBadges.push(BADGES.ASSESSMENT_COMPLETE.id);
    }
    
    // Existing conditions
    if (goals.length > 0) {
      newBadges.push(BADGES.FIRST_GOAL.id);
    }
    if (goals.length > 0 && goals.every((goal: any) => goal.status === 'completed')) {
      newBadges.push(BADGES.GOAL_MASTER.id);
    }
    
    if (userData.completedTutorials?.length > 0) {
      newBadges.push(BADGES.TUTORIAL_COMPLETE.id);
    }
    if (userData.completedTutorials?.length >= 10) {
      newBadges.push(BADGES.TUTORIAL_MASTER.id);
    }
    
    // New conditions for additional badges

    // Award FIRST_POST if the user has published posts
    if (userData.publishedPosts?.length > 0) {
      newBadges.push(BADGES.FIRST_POST.id);
    }

    // Remove the old likesReceived check
    // if (userData.likesReceived && userData.likesReceived >= 50) {
    //   newBadges.push(BADGES.ENGAGEMENT_STAR.id);
    // }

    // Replace with:
    if (userData.publishedPosts?.length > 0) {
      let totalLikes = 0;
      for (const postId of userData.publishedPosts as string[]) {
        const postRef = doc(db, 'posts', postId);
        const postDoc = await getDoc(postRef);
        const postData = postDoc.exists() ? postDoc.data() : null;
        if (postData && typeof postData.likes_count === 'number') {
          totalLikes += postData.likes_count;
        }
      }
      if (totalLikes >= 50) {
        newBadges.push(BADGES.ENGAGEMENT_STAR.id);
      }
    }

    // Award MILESTONE_30_DAYS if the account is older than or equal to 30 days
    if (userData.createdAt) {
      const createdAt = new Date(userData.createdAt);
      const now = new Date();
      const diffDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays >= 30) {
        newBadges.push(BADGES.MILESTONE_30_DAYS.id);
      }
    }
    
    // Award new badges
    for (const badgeId of newBadges) {
      await awardBadge(userId, badgeId);
    }
    
    return newBadges.map((id: string) => getBadgeById(id)).filter(Boolean);
  } catch (error) {
    console.error('Error checking badges:', error);
    throw error;
  }
};