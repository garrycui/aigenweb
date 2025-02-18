import express from 'express';
import bodyParser from 'body-parser';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import cron from 'node-cron';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

app.use(bodyParser.raw({ type: 'application/json' }));

// Subscription plans
const PLANS = {
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

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

app.post('/webhook', async (req: express.Request, res: express.Response): Promise<void> => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    if (err instanceof Error) {
      console.error('Webhook signature verification failed:', err.message);
    } else {
      console.error('Webhook signature verification failed:', err);
    }
    res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const clientReferenceId = session.client_reference_id;
    const customerId = session.customer as string;

    if (!clientReferenceId) {
      console.error('Client Reference ID is null or undefined');
      res.status(400).send('Client Reference ID is required');
      return;
    }

    if (!customerId) {
      console.error('Customer ID is null or undefined');
      res.status(400).send('Customer ID is required');
      return;
    }

    // Decode userId and priceId from clientReferenceId
    const [userId, priceId] = clientReferenceId.split(':');

    if (!userId) {
      console.error('User ID is null or undefined');
      res.status(400).send('User ID is required');
      return;
    }

    if (!priceId) {
      console.error('Price ID is null or undefined');
      res.status(400).send('Price ID is required');
      return;
    }

    let plan;
    let subscriptionEnd;
    const subscriptionStart = new Date();

    if (priceId === PLANS.MONTHLY.id) {
      plan = 'monthly';
      subscriptionEnd = new Date(subscriptionStart);
      subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
    } else if (priceId === PLANS.ANNUAL.id) {
      plan = 'annual';
      subscriptionEnd = new Date(subscriptionStart);
      subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
    } else {
      res.status(400).send('Unknown price ID');
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);
      const trialEndsAt = new Date(subscriptionStart.getTime() - 60000); // Set trialEndsAt to one minute before the current time
      await updateDoc(userRef, {
        stripeCustomerId: customerId,
        subscriptionStatus: 'active',
        subscriptionPlan: plan,
        subscriptionStart,
        subscriptionEnd,
        isTrialing: false, // End the trial period
        trialEndsAt, // Update trialEndsAt
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating Firestore with Stripe customer id:', error);
      res.status(500).send('Internal Server Error');
      return;
    }
  }

  res.status(200).send('Received');
});

// Scheduled job to check for expired subscriptions
cron.schedule('0 0 * * *', async () => {
  const now = new Date();
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('subscriptionEnd', '<=', now), where('subscriptionStatus', '==', 'active'));
  const querySnapshot = await getDocs(q);

  querySnapshot.forEach(async (doc) => {
    try {
      await updateDoc(doc.ref, {
        subscriptionStatus: 'expired',
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating subscription status:', error);
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));