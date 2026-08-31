import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useEntitlements } from '../hooks/useEntitlements';
import { toolIcon } from '../lib/toolIcons';
import { categoryGradient } from '../lib/categories';

function daysLeft(expiresAt: string | null): string {
  if (!expiresAt) return 'ตลอดชีพ';
  const ms = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'หมดอายุแล้ว';
  return `หมดอายุใน ${days} วัน`;
}

function useStripeReturnStatus() {
  const [status] = useState<'success' | 'cancelled' | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('checkout') as 'success' | 'cancelled' | null;
  });

  useEffect(() => {
    if (!status) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('checkout');
    url.searchParams.delete('order_id');
    window.history.replaceState({}, '', url.toString());
  }, [status]);

  return status;
}

export default function MyApps() {
  const { user } = useAuth();
  const { entitlements, loading, error, refetch } = useEntitlements();
  const stripeStatus = useStripeReturnStatus();
  const [polling, setPolling] = useState(stripeStatus === 'success');

  useEffect(() => {
    if (stripeStatus !== 'success') return;
    let count = 0;
    const interval = setInterval(() => {
      count += 1;
      refetch();
      if (count >= 4) {
        clearInterval(interval);
        setPolling(false);
      }
    }, 1500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripeStatus]);

  if (!user) return null;

  const banner = stripeStatus === 'success' && (
    <div className="mx-10 mt-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold px-4 py-3">
      {polling ? 'ชำระเงินสำเร็จ กำลังปลดล็อกแอปให้คุณ…' : 'ชำระเงินสำเร็จ! แอปของคุณพร้อมใช้งานแล้วด้านล่าง'}
    </div>
  );
  const cancelBanner = stripeStatus === 'cancelled' && (
    <div className="mx-10 mt-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold px-4 py-3">
      ยกเลิกการชำระเงินแล้ว คำสั่งซื้อยังค้างอยู่ในระบบ สามารถชำระเงินใหม่ได้ภายหลัง
    </div>
  );

  if (loading) return banner || cancelBanner || null;
  if (error) return banner || cancelBanner || null;
  if (entitlements.length === 0) return banner || cancelBanner || null;

  return (
    <>
      {banner}
      {cancelBanner}
      <div className="px-10 pt-2 pb-6">
        <h2 className="font-serif font-bold text-2xl text-brand-950 mb-1">แอปที่คุณซื้อแล้ว</h2>
        <p className="text-sm text-ink-500 mb-4.5">คลิกเพื่อเปิดใช้งานแอป</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {entitlements.filter((ent) => ent.tools).map((ent) => {
          const expiryLabel = daysLeft(ent.expires_at);
          const expired = expiryLabel === 'หมดอายุแล้ว';
          const Icon = toolIcon(ent.tools.slug);
          const gradient = categoryGradient(ent.tools.category);
          return (
            <a
              key={ent.id}
              href={ent.tools.app_base_url ?? '#'}
              target={ent.tools.app_base_url ? '_blank' : undefined}
              rel="noreferrer"
              className={`bg-white rounded-2xl border border-brand-100 shadow-sm p-5 flex flex-col gap-2.5 transition-all ${
                ent.tools.app_base_url && !expired
                  ? 'hover:shadow-lg hover:-translate-y-1 cursor-pointer'
                  : 'opacity-60 cursor-not-allowed pointer-events-none'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-sm`}
              >
                <Icon size={22} strokeWidth={2} />
              </div>
              <div className="font-bold text-[15.5px] text-ink-900">
                {ent.tools.name.replace(/^\S+\s/, '')}
              </div>
              <div className="text-xs text-ink-500 leading-relaxed">{ent.tools.description}</div>
              <span
                className={`self-start text-[10.5px] font-bold px-2.5 py-1 rounded-full mt-1 ${
                  expired
                    ? 'bg-red-50 text-red-600 border border-red-200'
                    : 'bg-orange-50 text-orange-600 border border-orange-200'
                }`}
              >
                {expiryLabel}
              </span>
              {!ent.tools.app_base_url && (
                <span className="text-[10.5px] text-ink-300">แอปยังไม่เปิดให้ใช้งาน</span>
              )}
            </a>
          );
        })}
      </div>
      </div>
    </>
  );
}
