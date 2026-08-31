import { useMemo, useState } from 'react';
import { Check, ShoppingCart } from 'lucide-react';
import type { BillingType, ToolWithPrices } from '../types';
import { useCart } from '../lib/cart';
import { toolIcon } from '../lib/toolIcons';
import { categoryGradient } from '../lib/categories';

interface Props {
  tool: ToolWithPrices;
  onAddedToCart: () => void;
  onBuyNow: () => void;
}

const PERIOD_LABELS: Record<BillingType, string> = {
  monthly: 'รายเดือน',
  yearly: 'รายปี',
  one_time: 'ครั้งเดียว',
};

function sortBySessions(prices: ToolWithPrices['prices']) {
  return [...prices].sort((a, b) => (a.max_sessions ?? 1) - (b.max_sessions ?? 1));
}

export default function ProductCard({ tool, onAddedToCart, onBuyNow }: Props) {
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const Icon = toolIcon(tool.slug);
  const gradient = categoryGradient(tool.category);

  // Distinct billing periods this tool is actually sold under — admin controls
  // this by which tool_prices rows exist, so a period only shows up here if
  // it's for sale.
  const periods = useMemo(
    () => Array.from(new Set(tool.prices.map((p) => p.billing_type))),
    [tool.prices],
  );
  const [billingType, setBillingType] = useState<BillingType | undefined>(periods[0]);

  const tiers = useMemo(
    () => sortBySessions(tool.prices.filter((p) => p.billing_type === billingType)),
    [tool.prices, billingType],
  );
  const [priceId, setPriceId] = useState<string | undefined>(tiers[0]?.id);

  const price = tool.prices.find((p) => p.id === priceId) ?? tiers[0] ?? null;
  const hasScreenChoice = tiers.length > 1;
  const hasPeriodChoice = periods.length > 1;

  function selectPeriod(bt: BillingType) {
    setBillingType(bt);
    const firstTier = sortBySessions(tool.prices.filter((p) => p.billing_type === bt))[0];
    setPriceId(firstTier?.id);
  }

  function handleAdd() {
    if (!price) return;
    addItem(tool, price);
    setJustAdded(true);
    onAddedToCart();
    setTimeout(() => setJustAdded(false), 1500);
  }

  function handleBuyNow() {
    if (!price) return;
    addItem(tool, price);
    onBuyNow();
  }

  return (
    <div className="bg-white rounded-2xl border border-brand-100 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-250 flex flex-col overflow-hidden group">
      <div className="p-5.5 flex flex-col gap-2.5 flex-1">
        <div
          className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform duration-250`}
        >
          <Icon size={22} strokeWidth={2} />
        </div>
        <div className="font-bold text-[15.5px] text-ink-900">
          {tool.name.replace(/^\S+\s/, '')}
        </div>
        <div className="text-xs text-ink-500 leading-relaxed min-h-9">{tool.description}</div>

        {hasPeriodChoice && (
          <div className="flex gap-1.5 mt-1">
            {periods.map((bt) => (
              <button
                key={bt}
                type="button"
                onClick={() => selectPeriod(bt)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                  billingType === bt
                    ? 'bg-brand-700 border-brand-700 text-white'
                    : 'bg-white border-line-200 text-ink-500'
                }`}
              >
                {PERIOD_LABELS[bt] ?? bt}
              </button>
            ))}
          </div>
        )}

        {hasScreenChoice && (
          <div className="flex flex-wrap gap-1.5">
            {tiers.map((tier) => (
              <button
                key={tier.id}
                type="button"
                onClick={() => setPriceId(tier.id)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                  priceId === tier.id
                    ? 'bg-teal-500 border-teal-500 text-brand-950'
                    : 'bg-white border-line-200 text-ink-500'
                }`}
              >
                {tier.max_sessions ? `${tier.max_sessions} จอ` : 'ไม่จำกัดจอ'}
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto pt-2">
          {price ? (
            <div className="text-xs text-ink-300 font-semibold">
              <span className="font-serif text-lg font-bold text-brand-700">
                ฿{price.price_baht.toLocaleString()}
              </span>
              <span className="text-ink-300">
                /{price.billing_type === 'yearly' ? 'ปี' : price.billing_type === 'one_time' ? 'ครั้ง' : 'เดือน'}
                {price.max_sessions ? ` · ${price.max_sessions} จอ` : ''}
              </span>
            </div>
          ) : (
            <div className="text-xs text-ink-300 font-semibold">ราคาเร็วๆ นี้</div>
          )}
        </div>

        <div className="flex gap-2 mt-2">
          <button
            type="button"
            disabled={!price}
            onClick={handleAdd}
            title="เพิ่มลงตะกร้า"
            className="w-11 h-10 flex items-center justify-center rounded-lg border-1.5 border-brand-500 text-brand-500 bg-white disabled:opacity-40"
          >
            {justAdded ? <Check size={18} /> : <ShoppingCart size={18} />}
          </button>
          <button
            type="button"
            disabled={!price}
            onClick={handleBuyNow}
            className="flex-1 rounded-lg bg-brand-500 hover:bg-brand-700 text-white font-bold text-sm transition-colors disabled:opacity-40"
          >
            ซื้อ
          </button>
        </div>
      </div>
    </div>
  );
}
