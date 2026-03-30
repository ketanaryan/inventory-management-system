import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

// Max safe payment amount — prevent manipulation (e.g. 10,00,000 INR max)
const MAX_AMOUNT_PAISE = 100_000_000;
const MIN_AMOUNT_PAISE = 100; // ₹1 minimum

export async function POST(req: Request) {
  // 1. Rate limit — 5 checkout attempts per minute per IP
  const ip = getClientIp(req);
  const { ok } = rateLimit(ip, 5, 60_000);
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait.' },
      { status: 429 }
    );
  }

  // 2. Guard against missing Stripe config
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Stripe is not configured on this server.' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { amount, orderId, medicineName } = body;

    // 3. Input validation — all required fields
    if (!amount || !orderId) {
      return NextResponse.json(
        { error: 'Missing required parameters: amount and orderId are required.' },
        { status: 400 }
      );
    }

    // 4. Type safety checks
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (typeof orderId !== 'string' || orderId.trim().length === 0 || orderId.length > 100) {
      return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 });
    }

    // 5. Amount bounds check to prevent manipulated prices
    const amountPaise = Math.round(amount * 100);
    if (amountPaise < MIN_AMOUNT_PAISE || amountPaise > MAX_AMOUNT_PAISE) {
      return NextResponse.json(
        { error: `Amount must be between ₹1 and ₹10,00,000.` },
        { status: 400 }
      );
    }

    // 6. Sanitize medicine name for display only
    const safeMedicineName = typeof medicineName === 'string'
      ? medicineName.replace(/[<>"']/g, '').trim().slice(0, 200)
      : 'Medicines';

    const origin = req.headers.get('origin');
    if (!origin) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'inr',
            product_data: {
              name: `Order for ${safeMedicineName}`,
              description: `Order ID: ${orderId}`,
            },
            unit_amount: amountPaise,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/api/confirm-payment?session_id={CHECKOUT_SESSION_ID}&order_id=${encodeURIComponent(orderId)}`,
      cancel_url: `${origin}/dashboard/dealer?payment=cancelled`,
      metadata: {
        orderId: orderId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe error:', err.message);
    // Never expose raw Stripe error details to client
    return NextResponse.json(
      { error: 'Payment session creation failed. Please try again.' },
      { status: 500 }
    );
  }
}
