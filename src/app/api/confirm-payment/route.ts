import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

// Always use service role key on server-side — never expose this on the client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const session_id = searchParams.get('session_id');
  const order_id = searchParams.get('order_id');

  // 1. Validate required params
  if (!session_id || !order_id) {
    return NextResponse.redirect(`${origin}/dashboard/dealer?payment=error`);
  }

  // 2. Sanitize order_id — only allow UUIDs (standard Supabase UUID format)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(order_id)) {
    console.error('Invalid order_id format in confirm-payment:', order_id);
    return NextResponse.redirect(`${origin}/dashboard/dealer?payment=error`);
  }

  // 3. Validate Stripe session_id format (starts with 'cs_')
  if (!session_id.startsWith('cs_') || session_id.length > 200) {
    console.error('Invalid session_id format:', session_id.slice(0, 20));
    return NextResponse.redirect(`${origin}/dashboard/dealer?payment=error`);
  }

  if (!process.env.STRIPE_SECRET_KEY || !supabaseServiceKey) {
    console.error('Missing server-side configuration');
    return NextResponse.redirect(`${origin}/dashboard/dealer?payment=error`);
  }

  try {
    // 4. Verify payment with Stripe (source of truth — cannot be faked)
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // 5. Cross-check: Stripe's metadata must match the order_id in the URL
    //    This prevents someone from reusing a valid session_id with a different order_id
    if (session.metadata?.orderId !== order_id) {
      console.error('Order ID mismatch between Stripe metadata and URL param');
      return NextResponse.redirect(`${origin}/dashboard/dealer?payment=error`);
    }

    if (session.payment_status === 'paid') {
      // Use service role client for server-side DB writes (bypasses RLS correctly)
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { error } = await supabase
        .from('dealer_orders')
        .update({ status: 'Paid' })
        .eq('id', order_id);

      if (error) {
        console.error('Supabase update error:', error.message);
        return NextResponse.redirect(`${origin}/dashboard/dealer?payment=error`);
      }

      return NextResponse.redirect(`${origin}/dashboard/dealer?payment=success`);
    } else {
      return NextResponse.redirect(`${origin}/dashboard/dealer?payment=failed`);
    }
  } catch (err: any) {
    console.error('Payment confirmation error:', err.message);
    return NextResponse.redirect(`${origin}/dashboard/dealer?payment=error`);
  }
}
