import { loadStripe } from '@stripe/stripe-js';
import { db } from './firebase';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';

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
    const stripe = await stripePromise;
    if (!stripe) {
      throw new Error('Stripe failed to initialize');
    }

    // Encode userId and priceId into clientReferenceId
    const clientReferenceId = `${userId}:${priceId}`;

    // Create the checkout session directly using Stripe Checkout
    const { error } = await stripe.redirectToCheckout({
      lineItems: [{
        price: priceId,
        quantity: 1
      }],
      mode: 'subscription',
      successUrl: `${window.location.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${window.location.origin}/dashboard`,
      billingAddressCollection: 'required',
      clientReferenceId: clientReferenceId
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
        end: null
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
      end: userData.subscriptionEnd?.toDate() || null
    };
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return {
      isActive: false,
      isTrialing: false,
      trialEndsAt: null,
      plan: null,
      start: null,
      end: null
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

// Update subscription status
export const updateSubscriptionStatus = async (userId: string, status: string, plan?: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      subscriptionStatus: status,
      subscriptionPlan: plan || null,
      isTrialing: false,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error updating subscription status:', error);
    throw error;
  }
};