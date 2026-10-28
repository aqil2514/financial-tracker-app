import {
  Banknote,
  Bitcoin,
  Building2,
  Car,
  Coins,
  CreditCard,
  Gem,
  Gift,
  HandCoins,
  Home,
  Landmark,
  PiggyBank,
  Plane,
  Receipt,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react-native";

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

export function resolveAccountIcon(icon: string | null): LucideIcon {
  if (!icon) return DEFAULT_ACCOUNT_ICON;
  return ACCOUNT_ICONS[icon] ?? DEFAULT_ACCOUNT_ICON;
}
