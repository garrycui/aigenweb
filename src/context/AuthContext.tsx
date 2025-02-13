import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getSubscriptionStatus, startTrial } from '../lib/stripe';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

type AuthUser = {
  id: string;
  email: string;
  name: string;
  trialEndsAt: Date | null;
  subscription: {
    status: 'trialing' | 'active' | 'canceled' | 'expired';
    plan: 'monthly' | 'annual' | null;
  };
  hasCompletedAssessment?: boolean;
};

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      if (firebaseUser) {
        // Get subscription status
        const subscription = await getSubscriptionStatus(firebaseUser.uid);
        
        setUser({
          id: firebaseUser.uid,
          email: firebaseUser.email!,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          trialEndsAt: subscription.trialEndsAt,
          subscription: {
            status: subscription.isTrialing ? 'trialing' : 
                    subscription.isActive ? 'active' : 'expired',
            plan: subscription.plan
          }
        });
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

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

      // Start trial period
      await startTrial(firebaseUser.uid);

      // Create/update Firestore document for the user
      await setDoc(
        doc(db, 'users', firebaseUser.uid),
        { createdAt: serverTimestamp() },
        { merge: true }
      );

      return {};
    } catch (error: any) {
      console.error('Sign up error:', error);
      return { error: error.message };
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
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