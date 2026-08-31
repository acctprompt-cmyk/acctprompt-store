import { useState } from 'react';
import { useCart } from '../lib/cart';
import { useAuth } from '../lib/auth';
import { submitOrder, claimFreeOrder } from '../lib/checkout';
import { createCheckoutSession } from '../lib/stripeCheckout';

const BILLING_LABELS: Record<string, string> = {
  monthly: 'รายเดือน',
  yearly: 'รายปี',
  one_time: 'ครั้งเดียว',
};

interface Props {
  onClose: () => void;
  onRequireLogin: () => void;
}

export default function CartDrawer({ onClose, onRequireLogin }: Props) {
  const { items, removeItem, clear, total } = useCart();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | { kind: 'success'; orderId: string }
    | { kind: 'free'; orderId: string }
    | { kind: 'error'; message: string }
    | null
  >(null);

  async function handleCheckout() {
    if (!user) {
      onRequireLogin();
      return;
    }
    setSubmitting(true);
    setResult(null);
    const res = await submitOrder(items);

    if (res.backendNotReady) {
      setSubmitting(false);
      console.error(
        '[checkout] backend RPC "checkout" ยังไม่มีในฐานข้อมูล — ดู proposal SQL ที่ขอไว้ในแชท',
        res.error,
      );
      setResult({
        kind: 'error',
        message: 'ระบบสั่งซื้อยังเปิดใช้งานไม่สมบูรณ์ในขณะนี้ กรุณาลองใหม่ภายหลัง',
      });
      return;
    }
    if (res.error || !res.orderId) {
      setSubmitting(false);
      setResult({ kind: 'error', message: res.error ?? 'สั่งซื้อไม่สำเร็จ' });
      return;
    }

    // ฿0 order (trial/free pricing) — skip Stripe, grant entitlements directly.
    if (res.totalBaht === 0) {
      const freeRes = await claimFreeOrder(res.orderId);
      setSubmitting(false);
      if (freeRes.error) {
        setResult({ kind: 'error', message: freeRes.error });
        return;
      }
      setResult({ kind: 'free', orderId: res.orderId });
      clear();
      return;
    }

    const stripeRes = await createCheckoutSession(res.orderId);
    if (stripeRes.error || !stripeRes.url) {
      setSubmitting(false);
      setResult({ kind: 'success', orderId: res.orderId });
      console.error(
        '[stripe] สร้างรายการชำระเงินไม่สำเร็จ — คำสั่งซื้อถูกบันทึกไว้แล้ว รอทีมงานยืนยันการชำระเงินแทน',
        stripeRes.error,
      );
      clear();
      return;
    }

    clear();
    window.location.href = stripeRes.url;
    // submitting intentionally left true — page is navigating away to Stripe
  }

  return (
    <div className="fixed inset-0 bg-ink-900/55 flex items-center justify-end z-100" onClick={onClose}>
      <div
        className="bg-white h-full w-full max-w-md shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-line-200">
          <h2 className="font-serif font-bold text-lg text-brand-950">ตะกร้าสินค้า</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-line-100 text-ink-500"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          {items.length === 0 && (
            <div className="text-ink-500 text-center py-16">ตะกร้าของคุณว่างเปล่า</div>
          )}

          {items.map((item) => (
            <div
              key={item.priceId}
              className="flex items-start justify-between gap-3 bg-panel-50 rounded-xl p-4"
            >
              <div>
                <div className="font-bold text-sm text-ink-900">{item.toolName}</div>
                <div className="text-xs text-ink-500 mt-1">
                  {BILLING_LABELS[item.billingType] ?? item.billingType}
                  {item.maxSessions ? ` · ${item.maxSessions} จอ` : ' · ไม่จำกัดจอ'}
                </div>
                <div className="font-serif font-bold text-brand-700 mt-1">
                  ฿{item.priceBaht.toLocaleString()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.priceId)}
                className="text-red-600 text-xs font-semibold"
              >
                ลบ
              </button>
            </div>
          ))}
        </div>

        {result && (
          <div
            className={`mx-5 mb-3 rounded-lg p-3 text-xs font-semibold ${
              result.kind === 'error'
                ? 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}
          >
            {result.kind === 'free' && 'รับสิทธิ์ใช้งานฟรีสำเร็จแล้ว! เปิดดูได้ที่ "แอปที่คุณซื้อแล้ว" ด้านบน'}
            {result.kind === 'success' &&
              `สั่งซื้อสำเร็จ (เลขที่คำสั่งซื้อ ${result.orderId}) — รอทีมงานยืนยันการชำระเงิน`}
            {result.kind === 'error' && result.message}
          </div>
        )}

        <div className="p-5 border-t border-line-200">
          <div className="flex justify-between items-center mb-3">
            <span className="text-ink-500 text-sm">ยอดรวม</span>
            <span className="font-serif font-bold text-xl text-brand-950">
              ฿{total.toLocaleString()}
            </span>
          </div>
          <button
            type="button"
            disabled={items.length === 0 || submitting}
            onClick={handleCheckout}
            className="w-full bg-brand-950 text-white rounded-lg py-3.5 font-bold text-sm disabled:opacity-50"
          >
            {submitting ? 'กำลังดำเนินการ…' : 'ยืนยันสั่งซื้อ'}
          </button>
        </div>
      </div>
    </div>
  );
}
