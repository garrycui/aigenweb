import express from 'express';
import Stripe from 'stripe';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, collection, getDocs, query, where, getDoc } from 'firebase/firestore';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';

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
app.use((req, res, next) => {
  if (req.originalUrl === '/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// API endpoint to cancel subscription
app.post('/api/cancel-subscription', async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    
    // Cancel the subscription at period end
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true
    });

    res.json({ success: true, subscription });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// API endpoint to resume subscription
app.post('/api/resume-subscription', async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    
    // Resume the subscription
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    });

    res.json({ success: true, subscription });
  } catch (error) {
    console.error('Error resuming subscription:', error);
    res.status(500).json({ error: 'Failed to resume subscription' });
  }
});

// API endpoint to create billing portal session
app.post('/api/create-portal-session', async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Get user's Stripe customer ID
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const stripeCustomerId = userDoc.data()?.stripeCustomerId;

    if (!stripeCustomerId) {
      throw new Error('No Stripe customer ID found');
    }

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.VITE_APP_URL}/subscription`
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// Webhook endpoint
app.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const body = req.body;

    if (!sig) {
      console.error('Stripe signature is missing');
      res.status(400).send('Stripe signature is required');
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
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

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const clientReferenceId = session.client_reference_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!clientReferenceId || !customerId || !subscriptionId) {
          res.status(400).send('Missing required fields');
          return;
        }

        const [userId, priceId] = clientReferenceId.split(':');
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const metadata = subscription.metadata || {};

        // Handle plan switch if there's a previous subscription
        if (metadata.previousSubscriptionId) {
          // Cancel the old subscription immediately
          await stripe.subscriptions.cancel(metadata.previousSubscriptionId);
        }

        // Determine subscription details
        let plan;
        let subscriptionEnd;
        const subscriptionStart = new Date(subscription.current_period_start * 1000);

        if (priceId === PLANS.MONTHLY.id) {
          plan = 'monthly';
          subscriptionEnd = new Date(subscription.current_period_end * 1000);
        } else if (priceId === PLANS.ANNUAL.id) {
          plan = 'annual';
          subscriptionEnd = new Date(subscription.current_period_end * 1000);
        } else {
          res.status(400).send('Invalid price ID');
          return;
        }

        // Update user in Firestore
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: 'active',
          subscriptionPlan: plan,
          subscriptionStart,
          subscriptionEnd,
          isTrialing: false,
          cancelAtPeriodEnd: false,
          updatedAt: new Date()
        });

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;

        if (!userId) {
          res.status(400).send('Missing user ID in metadata');
          return;
        }

        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          subscriptionEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          updatedAt: new Date()
        });

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;

        if (!userId) {
          res.status(400).send('Missing user ID in metadata');
          return;
        }

        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          subscriptionStatus: 'expired',
          stripeSubscriptionId: null,
          updatedAt: new Date()
        });

        break;
      }
    }

    res.status(200).send('Webhook processed');
  }
);

// Scheduled job to check for expired subscriptions
cron.schedule('0 0 * * *', async () => {
  const now = new Date();
  const usersRef = collection(db, 'users');
  const q = query(
    usersRef,
    where('subscriptionEnd', '<=', now),
    where('subscriptionStatus', '==', 'active')
  );
  
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

// Health check endpoint
app.get('/_ah/health', (_req, res) => {
  res.status(200).send('OK');
});

// Serve static files from the dist directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '../dist')));

// Catch-all route to serve index.html for all non-API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});