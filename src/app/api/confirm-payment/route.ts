import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16" as any,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseRoleKey);

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const session_id = searchParams.get('session_id');
  const order_id = searchParams.get('order_id');

  if (!session_id || !order_id) {
    return NextResponse.redirect(`${origin}/dashboard/dealer?payment=error&message=MissingParameters`);
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status === 'paid') {
      // Update order status in Supabase
      const { error } = await supabase
        .from('dealer_orders')
        .update({ status: 'Paid' })
        .eq('id', order_id);

      if (error) {
        console.error("Error updating Supabase:", error);
        return NextResponse.redirect(`${origin}/dashboard/dealer?payment=error&message=DatabaseUpdateFailed`);
      }

      return NextResponse.redirect(`${origin}/dashboard/dealer?payment=success&order_id=${order_id}`);
    } else {
      return NextResponse.redirect(`${origin}/dashboard/dealer?payment=failed`);
    }
  } catch (err: any) {
    console.error("Error confirming payment:", err);
    return NextResponse.redirect(`${origin}/dashboard/dealer?payment=error&message=SessionVerificationFailed`);
  }
}
