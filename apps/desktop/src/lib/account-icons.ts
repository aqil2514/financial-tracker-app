import {
  Banknote,
  Bitcoin,
  Building2,
  Car,
  Coins,
  CreditCard,
  Gem,
  Gift,
  Home,
  HandCoins,
  Landmark,
  PiggyBank,
  Plane,
  Receipt,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Whitelist nama icon lucide-react untuk `accounts.icon` — sengaja
 * TIDAK seluruh library (ratusan icon), cuma yang relevan untuk konteks
 * akun keuangan (dompet, bank, kartu, tunai, investasi, dst), supaya
 * daftar pilihan di picker tidak kebanyakan. Lihat
 * docs/todos/plan/account-icon-picker.md.
 */
export const ACCOUNT_ICONS: Record<string, LucideIcon> = {
  Wallet,
  Banknote,
  PiggyBank,
  Landmark,
  CreditCard,
  Coins,
  TrendingUp,
  Bitcoin,
  Building2,
  HandCoins,
  Gem,
  Home,
  Car,
  Plane,
  ShoppingBag,
  Smartphone,
  Receipt,
  Gift,
};

export const ACCOUNT_ICON_NAMES = Object.keys(ACCOUNT_ICONS);

export const DEFAULT_ACCOUNT_ICON: LucideIcon = Wallet;

/** Komponen lucide untuk `accounts.icon` — fallback ke icon default
 * kalau null atau nama tidak dikenali (mis. dari data lama). */
export function resolveAccountIcon(icon: string | null): LucideIcon {
  if (!icon) return DEFAULT_ACCOUNT_ICON;
  return ACCOUNT_ICONS[icon] ?? DEFAULT_ACCOUNT_ICON;
}
