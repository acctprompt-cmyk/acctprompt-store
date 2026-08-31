// Deploy via Supabase Dashboard → Edge Functions → New function → name: create-checkout-session
// Secrets required (Dashboard → Edge Functions → Manage secrets):
//   STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are auto-injected by Supabase already)

import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('กรุณาเข้าสู่ระบบก่อนชำระเงิน');

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error: userErr,
    } = await supabaseUser.auth.getUser();
    if (userErr || !user) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');

    const { order_id } = await req.json();
    if (!order_id) throw new Error('order_id is required');

    const { data: orders, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, customer_id, status, order_items(price_baht, billing_type, tools(name))')
      .eq('id', order_id);

    if (orderErr || !orders || orders.length !== 1) throw new Error('ไม่พบคำสั่งซื้อนี้');
    const order = orders[0];
    if (order.customer_id !== user.id) throw new Error('ไม่มีสิทธิ์เข้าถึงคำสั่งซื้อนี้');
    if (order.status !== 'pending') throw new Error('คำสั่งซื้อนี้ไม่สามารถชำระเงินได้ (สถานะไม่ใช่ pending)');

    const origin = req.headers.get('origin') ?? Deno.env.get('STORE_URL') ?? '';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'promptpay'],
      line_items: order.order_items.map((item: { price_baht: number; tools: { name: string } | null }) => ({
        price_data: {
          currency: 'thb',
          product_data: { name: item.tools?.name ?? 'AcctPrompt Tool' },
          unit_amount: Math.round(item.price_baht * 100),
        },
        quantity: 1,
      })),
      metadata: { order_id: order.id },
      success_url: `${origin}/?checkout=success&order_id=${order.id}`,
      cancel_url: `${origin}/?checkout=cancelled`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
