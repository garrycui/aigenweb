import { loadStripe } from '@stripe/stripe-js';
import { db } from './firebase';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import axios from 'axios';

// Initialize Stripe with publishable key
export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Subscription plans
export const PLANS = {
  MONTHLY: {
    id: 'price_1QrTOTQ1fESgBlyzNlgLYddv',
    name: 'Monthly',
    price: 9.99,
    interval: 'month',
    trialDays: 7
  },
  ANNUAL: {
    id: 'price_1QtZVDQ1fESgBlyz9fSo3ir9',
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
    // First create a checkout session on the server
    const response = await axios.post('/api/create-checkout-session', {
      userId,
      priceId
    });
    
    // Then redirect to the checkout using the session ID
    const stripe = await stripePromise;
    if (!stripe) {
      throw new Error('Stripe failed to initialize');
    }
    
    const { error } = await stripe.redirectToCheckout({
      sessionId: response.data.id
    });

    if (error) {
      console.error('Stripe checkout error:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

// Get subscription status
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
        plan: null,
        start: null,
        end: null,
        cancelAtPeriodEnd: false
      };
    }

    const now = new Date();
    const trialEndsAt = userData.trialEndsAt?.toDate();
    const isTrialing = trialEndsAt ? now < trialEndsAt : false;

    return {
      isActive: userData.subscriptionStatus === 'active' || isTrialing,
      isTrialing,
      trialEndsAt: trialEndsAt || null,
      plan: userData.subscriptionPlan || null,
      start: userData.subscriptionStart?.toDate() || null,
      end: userData.subscriptionEnd?.toDate() || null,
      cancelAtPeriodEnd: userData.cancelAtPeriodEnd || false,
      stripeSubscriptionId: userData.stripeSubscriptionId || null
    };
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return {
      isActive: false,
      isTrialing: false,
      trialEndsAt: null,
      plan: null,
      start: null,
      end: null,
      cancelAtPeriodEnd: false
    };
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
      subscriptionPlan: null,
      updatedAt: new Date()
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

// Cancel subscription
export const cancelSubscription = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    if (!userData?.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    // Call server endpoint to cancel subscription
    const response = await axios.post('/api/cancel-subscription', {
      userId,
      subscriptionId: userData.stripeSubscriptionId
    });

    if (response.data.success) {
      // Update local state
      await updateDoc(userRef, {
        cancelAtPeriodEnd: true,
        updatedAt: new Date()
      });
      return { success: true };
    } else {
      throw new Error('Failed to cancel subscription');
    }
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
};

// Resume canceled subscription
export const resumeSubscription = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    if (!userData?.stripeSubscriptionId) {
      throw new Error('No subscription found');
    }

    // Call server endpoint to resume subscription
    const response = await axios.post('/api/resume-subscription', {
      userId,
      subscriptionId: userData.stripeSubscriptionId
    });

    if (response.data.success) {
      // Update local state
      await updateDoc(userRef, {
        cancelAtPeriodEnd: false,
        updatedAt: new Date()
      });
      return { success: true };
    } else {
      throw new Error('Failed to resume subscription');
    }
  } catch (error) {
    console.error('Error resuming subscription:', error);
    throw error;
  }
};

// Get billing portal URL
export const getBillingPortalUrl = async (userId: string) => {
  try {
    const response = await axios.post('/api/create-portal-session', {
      userId
    });
    return response.data.url;
  } catch (error) {
    console.error('Error getting billing portal URL:', error);
    throw error;
  }
};