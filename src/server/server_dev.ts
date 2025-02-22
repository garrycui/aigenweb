import express from 'express';
import Stripe from 'stripe';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env.development');
dotenv.config({ path: envPath });

const app = express();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('Stripe secret key is not defined');
}
const stripe = new Stripe(stripeSecretKey);

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

// Use JSON parser for all non-webhook routes
app.use(
  (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): void => {
    if (req.originalUrl === '/webhook') {
      next();
    } else {
      express.json()(req, res, next);
    }
  }
);

// Webhook endpoint
app.post(
  '/webhook',
  // Stripe requires the raw body to construct the event
  express.raw({type: 'application/json'}),
  async (req: express.Request, res: express.Response): Promise<void> => {
    const sig = req.headers['stripe-signature'];
    const body = req.body;
    console.log('Stripe webhook received:', body);
    console.log('Stripe signature:', sig);

    if (!sig) {
      console.error('Stripe signature is missing');
      res.status(400).send('Stripe signature is required');
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET_TEST!);
      console.log('Event constructed:', process.env.STRIPE_WEBHOOK_SECRET_TEST);
    } catch (err) {
      if (err instanceof Error) {
        console.log(`❌ Error message: ${err.message}`);
        res.status(400).send(`Webhook Error: ${err.message}`);
      } else {
        console.log('❌ Unknown error');
        res.status(400).send('Webhook Error: Unknown error');
      }
      return;
    }

    // Successfully constructed event
    console.log('✅ Success:', event.id);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const clientReferenceId = session.client_reference_id;
      const customerId = session.customer as string;

      console.log('Checkout session completed event received');
      console.log('Client Reference ID:', clientReferenceId);
      console.log('Customer ID:', customerId);

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

      console.log('User ID:', userId);
      console.log('Price ID:', priceId);

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
        console.log('Monthly plan selected');
      } else if (priceId === PLANS.ANNUAL.id) {
        plan = 'annual';
        subscriptionEnd = new Date(subscriptionStart);
        subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
        console.log('Annual plan selected');
      } else {
        console.error('Invalid price ID');
        res.status(400).send('Invalid price ID');
        return;
      }

      try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          subscriptionStatus: 'active',
          subscriptionPlan: plan,
          subscriptionStart,
          subscriptionEnd,
          updatedAt: new Date()
        });

        console.log('User subscription updated successfully');
        res.status(200).send('User subscription updated successfully');
      } catch (error) {
        console.error('Error updating user subscription:', error);
        res.status(500).send('Internal Server Error');
      }
    } else {
      console.log('Unhandled event type:', event.type);
    }

    res.status(200).send('Received');
  }
);

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
      console.log('Subscription status updated to expired for user:', doc.id);
    } catch (error) {
      console.error('Error updating subscription status for user:', doc.id, error);
    }
  });
});

// Health check endpoint
app.get('/_ah/health', (_req, res) => {
  res.status(200).send('OK');
});

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, '../src')));

// Catch-all route to serve index.html for all non-API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../src/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Development server is running on port ${PORT}`);
});