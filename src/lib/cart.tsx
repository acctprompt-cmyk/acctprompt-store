import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { BillingType, ToolPrice, ToolWithPrices } from '../types';

export interface CartItem {
  priceId: string;
  toolId: string;
  toolName: string;
  billingType: BillingType;
  priceBaht: number;
  maxSessions: number | null;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (tool: ToolWithPrices, price: ToolPrice) => void;
  removeItem: (priceId: string) => void;
  clear: () => void;
  total: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'acctprompt_cart';

function loadStored(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadStored);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  function addItem(tool: ToolWithPrices, price: ToolPrice) {
    setItems((prev) => {
      if (prev.some((i) => i.priceId === price.id)) return prev;
      return [
        ...prev,
        {
          priceId: price.id,
          toolId: tool.id,
          toolName: tool.name,
          billingType: price.billing_type,
          priceBaht: price.price_baht,
          maxSessions: price.max_sessions,
        },
      ];
    });
  }

  function removeItem(priceId: string) {
    setItems((prev) => prev.filter((i) => i.priceId !== priceId));
  }

  function clear() {
    setItems([]);
  }

  const total = items.reduce((sum, i) => sum + i.priceBaht, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clear, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
