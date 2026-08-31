import { supabase } from './supabase';
import type { CartItem } from './cart';

export interface CheckoutResult {
  orderId: string | null;
  totalBaht: number | null;
  error: string | null;
  /** true when the backend hasn't exposed an order-creation path yet (RPC missing / RLS blocks insert) */
  backendNotReady: boolean;
}

/**
 * Calls the `checkout` RPC (SECURITY DEFINER, to be added in acctprompt-platform).
 * Server must re-validate tool_prices itself — never trust priceBaht from the client.
 */
export async function submitOrder(items: CartItem[]): Promise<CheckoutResult> {
  if (items.length === 0) {
    return { orderId: null, totalBaht: null, error: 'ตะกร้าว่างเปล่า', backendNotReady: false };
  }

  const payload = {
    p_items: items.map((i) => ({
      price_id: i.priceId,
    })),
  };

  const { data, error } = await supabase.rpc('checkout', payload);

  if (error) {
    // PGRST202 = function not found in schema cache → backend gap, not a user error.
    const notReady = error.code === 'PGRST202' || error.message.includes('schema cache');
    return { orderId: null, totalBaht: null, error: error.message, backendNotReady: notReady };
  }

  const result = data as { order_id?: string; total_baht?: number } | null;
  const orderId = result?.order_id ?? null;
  const totalBaht = result?.total_baht ?? null;
  return { orderId, totalBaht, error: null, backendNotReady: false };
}

/** Claims a ฿0 order directly (trial/free pricing) — skips Stripe entirely. */
export async function claimFreeOrder(orderId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('checkout_free', { p_order_id: orderId });
  return { error: error?.message ?? null };
}
