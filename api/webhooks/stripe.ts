import Stripe from 'stripe';
import { updateSubscriptionStatus } from '../../src/lib/stripe';

const stripe = new Stripe(process.env.VITE_STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

const webhookSecret = process.env.VITE_STRIPE_WEBHOOK_SECRET!;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      webhookSecret
    );

    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription;
        await updateSubscriptionStatus(
          subscription.metadata.userId,
          subscription.status,
          subscription.items.data[0].price.id
        );
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription;
        await updateSubscriptionStatus(
          deletedSubscription.metadata.userId,
          'canceled'
        );
        break;

      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        // Handle successful checkout
        if (session.mode === 'subscription') {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          await updateSubscriptionStatus(
            session.metadata?.userId!,
            subscription.status,
            subscription.items.data[0].price.id
          );
        }
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}