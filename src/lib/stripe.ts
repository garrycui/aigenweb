import { loadStripe } from '@stripe/stripe-js';
import { db } from './firebase';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';

// Initialize Stripe
export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Subscription plans
export const PLANS = {
  MONTHLY: {
    id: 'prod_RkzNRPoVNvORlF',
    name: 'Monthly',
    price: 9.99,
    interval: 'month',
    trialDays: 7
  },
  ANNUAL: {
    id: 'prod_Rl1sIbE0yjGqLX',
    name: 'Annual',
    price: 99.99,
    interval: 'year',
    trialDays: 7,
    discount: '17%'
  }
};

// Create checkout session
export const createCheckoutSession = async (userId: string, priceId: string) => {
  try {
    console.log('Creating checkout session with:', { userId, priceId });

    // Adjust the URL to your actual running server or use relative path
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        priceId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const { sessionId } = await response.json();
    console.log('Received sessionId:', sessionId);
    const stripe = await stripePromise;
    
    if (!stripe) {
      throw new Error('Stripe failed to initialize');
    }

    const { error } = await stripe.redirectToCheckout({ sessionId });
    
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

// Get user subscription status
export const getSubscriptionStatus = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    if (!userData) {
      return {
        isActive: false,
        isTrialing: false,
        trialEndsAt: null,
        plan: null
      };
    }

    const now = new Date();
    const trialEndsAt = userData.trialEndsAt?.toDate();
    const isTrialing = trialEndsAt ? now < trialEndsAt : false;

    return {
      isActive: userData.subscriptionStatus === 'active' || isTrialing,
      isTrialing,
      trialEndsAt: trialEndsAt || null,
      plan: userData.subscriptionPlan || null
    };
  } catch (error) {
    console.error('Error getting subscription status:', error);
    throw error;
  }
};

// Start trial period
export const startTrial = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + PLANS.MONTHLY.trialDays);

    await setDoc(userRef, {
      trialEndsAt,
      isTrialing: true,
      subscriptionStatus: 'trialing',
      subscriptionPlan: null
    }, { merge: true });

    return {
      isTrialing: true,
      trialEndsAt
    };
  } catch (error) {
    console.error('Error starting trial:', error);
    throw error;
  }
};

// Update subscription status
export const updateSubscriptionStatus = async (userId: string, status: string, plan?: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      subscriptionStatus: status,
      subscriptionPlan: plan || null,
      isTrialing: false
    });
  } catch (error) {
    console.error('Error updating subscription status:', error);
    throw error;
  }
};