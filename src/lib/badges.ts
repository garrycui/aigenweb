import { db } from './firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';

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
    
    return BADGES[badgeId as keyof typeof BADGES];
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
    return badgeIds.map(id => BADGES[id as keyof typeof BADGES]);
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
    const newBadges = [];
    
    // Check assessment completion
    if (userData.hasCompletedAssessment) {
      newBadges.push(BADGES.ASSESSMENT_COMPLETE.id);
    }
    
    // Check learning goals
    if (userData.learningGoals?.length > 0) {
      newBadges.push(BADGES.FIRST_GOAL.id);
    }
    if (userData.learningGoals?.every(goal => goal.status === 'completed')) {
      newBadges.push(BADGES.GOAL_MASTER.id);
    }
    
    // Check tutorials
    if (userData.completedTutorials?.length > 0) {
      newBadges.push(BADGES.TUTORIAL_COMPLETE.id);
    }
    if (userData.completedTutorials?.length >= 10) {
      newBadges.push(BADGES.TUTORIAL_MASTER.id);
    }
    
    // Award new badges
    for (const badgeId of newBadges) {
      await awardBadge(userId, badgeId);
    }
    
    return newBadges.map(id => BADGES[id as keyof typeof BADGES]);
  } catch (error) {
    console.error('Error checking badges:', error);
    throw error;
  }
};