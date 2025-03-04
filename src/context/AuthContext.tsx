import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { startTrial } from '../lib/stripe'; 
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  getUserWithSubscription, 
  createUser, 
  invalidateUserCache,
  removeSubscriptionCallback,
  cleanupAllSubscriptionListeners
} from '../lib/cache';

type AuthUser = {
  id: string;
  email: string;
  name: string;
  trialEndsAt: Date | null;
  
  // Subscription fields matching server implementation
  subscriptionStatus?: 'active' | 'inactive' | 'expired';
  subscriptionPlan?: 'monthly' | 'annual' | null;
  subscriptionStart?: Date;
  subscriptionEnd?: Date;
  isTrialing?: boolean;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string; // Add this property
  stripeSubscriptionId?: string; // Add this property
  
  // Assessment data
  hasCompletedAssessment?: boolean;
  mbtiType?: string;
  aiPreference?: string;
  
  // Profile information
  bio?: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  website?: string;
  twitter?: string;
  linkedin?: string;
  
  // User progress & engagement data
  completedTutorials?: string[];
  publishedPosts?: string[];
  likesReceived?: number;
  badges?: string[];
  
  // Review system data
  hasReviewed?: boolean;
  lastReviewedAt?: Date;
  
  // User activity tracking
  lastActivityAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;

  // Allow dynamic indexing with string keys
  [key: string]: any;
};

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  invalidateUserCache: (userId?: string) => void; // Add new function
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Enhance the subscription update handler to validate data
  const handleSubscriptionUpdate = useCallback((subscriptionData: Record<string, any>) => {
    setUser(prevUser => {
      if (!prevUser) return null;
      
      // Validate dates coming in from subscription data
      const processedData: Record<string, any> = {};
      
      Object.entries(subscriptionData).forEach(([key, value]) => {
        if (value instanceof Date) {
          processedData[key] = value;
        } else if (typeof value === 'object' && value?.toDate) {
          // Convert any Firestore timestamps
          processedData[key] = value.toDate();
        } else {
          processedData[key] = value;
        }
      });
      
      return { ...prevUser, ...processedData } as AuthUser;
    });
  }, []);

  // Clean up all listeners on component unmount
  useEffect(() => {
    return () => {
      cleanupAllSubscriptionListeners();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      if (firebaseUser) {
        try {
          const userId = firebaseUser.uid;
          
          // Get user data with subscription listener
          const userData = await getUserWithSubscription(userId, handleSubscriptionUpdate);
          
          if (userData) {
            // Ensure name is set
            if (!userData.name && firebaseUser.displayName) {
              await updateDoc(doc(db, 'users', userId), {
                name: firebaseUser.displayName,
                displayName: firebaseUser.displayName
              });
              userData.name = firebaseUser.displayName;
              userData.displayName = firebaseUser.displayName;
            }
            setUser(userData as AuthUser);
          } else {
            // User authenticated but no Firestore record - create one
            const newUserData = {
              email: firebaseUser.email!,
              name: firebaseUser.displayName || '',
              displayName: firebaseUser.displayName || '',
              createdAt: new Date(),
              updatedAt: new Date()
            };
            const createdUser = await createUser(userId, newUserData);
            setUser(createdUser as AuthUser);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [handleSubscriptionUpdate]);

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return {};
    } catch (error: any) {
      console.error('Sign in error:', error);
      return { error: error.message };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update user profile with name
      await updateProfile(firebaseUser, {
        displayName: name
      });

      // Create user data with direct Date objects (not Firestore timestamps)
      const userData = {
        name: name,
        email: email,
        createdAt: new Date(),
        updatedAt: new Date(),
        displayName: name // Add explicit displayName field
      };

      // Create/update Firestore document for the user
      await setDoc(
        doc(db, 'users', firebaseUser.uid),
        userData,
        { merge: true }
      );

      // Start trial period after user document is created
      await startTrial(firebaseUser.uid);

      // Wait briefly to ensure Firestore has processed our write
      await new Promise(resolve => setTimeout(resolve, 500));

      // Invalidate user cache on signup using the new helper
      invalidateUserCache(firebaseUser.uid);

      return {};
    } catch (error: any) {
      console.error('Sign up error:', error);
      return { error: error.message };
    }
  };

  const signOut = async () => {
    try {
      if (user) {
        // Remove subscription callback when signing out
        removeSubscriptionCallback(user.id, handleSubscriptionUpdate);
        invalidateUserCache(user.id);
      }
      
      await firebaseSignOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut, invalidateUserCache }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};