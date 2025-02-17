import Stripe from 'stripe';

const stripe = new Stripe(process.env.VITE_STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  try {
    console.log('Request received:', req.body); // Add logging

    const { userId, priceId } = req.body;
    if (!userId || !priceId) {
      return res.status(400).json({ error: 'Missing userId or priceId' });
    }

    // Create or retrieve customer
    const customers = await stripe.customers.list({
      email: req.user?.email || '',
      limit: 1
    });
    
    let customer;
    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: req.user.email,
        metadata: {
          userId: userId
        }
      });
    }

    console.log('Customer created or retrieved:', customer.id); // Add logging

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: `${process.env.VITE_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.VITE_APP_URL}/dashboard`,
      metadata: {
        userId: userId
      }
    });

    console.log('Checkout session created:', session.id); // Add logging

    return res.json({ sessionId: session.id });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    return res.status(500).json({ error: err.message });
  }
}