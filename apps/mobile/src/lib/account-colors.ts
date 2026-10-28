export const ACCOUNT_COLORS: Record<string, { label: string; text: string; bg: string; hex: string }> = {
  slate: { label: "Abu-abu", text: "text-slate-600", bg: "bg-slate-600", hex: "#475569" },
  red: { label: "Merah", text: "text-red-600", bg: "bg-red-600", hex: "#dc2626" },
  orange: { label: "Oranye", text: "text-orange-600", bg: "bg-orange-600", hex: "#ea580c" },
  amber: { label: "Kuning", text: "text-amber-600", bg: "bg-amber-600", hex: "#d97706" },
  green: { label: "Hijau", text: "text-green-600", bg: "bg-green-600", hex: "#16a34a" },
  teal: { label: "Teal", text: "text-teal-600", bg: "bg-teal-600", hex: "#0d9488" },
  blue: { label: "Biru", text: "text-blue-600", bg: "bg-blue-600", hex: "#2563eb" },
  indigo: { label: "Indigo", text: "text-indigo-600", bg: "bg-indigo-600", hex: "#4f46e5" },
  purple: { label: "Ungu", text: "text-purple-600", bg: "bg-purple-600", hex: "#9333ea" },
  pink: { label: "Pink", text: "text-pink-600", bg: "bg-pink-600", hex: "#db2777" },
};

export const ACCOUNT_COLOR_NAMES = Object.keys(ACCOUNT_COLORS);

export const DEFAULT_ACCOUNT_COLOR = "slate";

export function resolveAccountColorText(color: string | null): string {
  if (!color) return ACCOUNT_COLORS[DEFAULT_ACCOUNT_COLOR].text;
  return ACCOUNT_COLORS[color]?.text ?? ACCOUNT_COLORS[DEFAULT_ACCOUNT_COLOR].text;
}

export function resolveAccountColorHex(color: string | null): string {
  if (!color) return ACCOUNT_COLORS[DEFAULT_ACCOUNT_COLOR].hex;
  return ACCOUNT_COLORS[color]?.hex ?? ACCOUNT_COLORS[DEFAULT_ACCOUNT_COLOR].hex;
}
