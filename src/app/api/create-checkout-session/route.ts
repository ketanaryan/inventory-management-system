import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16" as any,
});

export async function POST(req: Request) {
  try {
    const { amount, orderId, medicineName } = await req.json();

    if (!amount || !orderId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe is not configured on this server. Please add STRIPE_SECRET_KEY to environment variables.' }, { status: 500 });
    }

    // Create Checkout Sessions from body params.
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'inr', 
            product_data: {
              name: `Order for ${medicineName || 'Medicines'}`,
              description: `Order ID: ${orderId}`,
            },
            unit_amount: Math.round(amount * 100), // Stripe expects amount in sub-units (paise/cents)
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.get('origin')}/api/confirm-payment?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `${req.headers.get('origin')}/dashboard/dealer?payment=cancelled`,
      metadata: {
        orderId: orderId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
