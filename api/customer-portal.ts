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
    console.log('Customer portal request:', req.body);
    const { customerId } = req.body;
    if (!customerId) {
      return res.status(400).json({ error: 'Missing customerId' });
    }

    // Create customer portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.VITE_APP_URL}/dashboard`
    });

    console.log('Customer portal session created:', session.url);
    return res.json({ url: session.url });
  } catch (err) {
    console.error('Error creating customer portal session:', err);
    res.status(500).json({ error: err.message });
  }
}