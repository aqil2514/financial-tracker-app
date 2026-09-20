/**
 * Palet warna TERBATAS untuk `accounts.color` — BUKAN color picker
 * bebas, supaya hasilnya tetap konsisten dengan desain sistem aplikasi
 * (yang sendirinya monokrom, lihat globals.css) dan otomatis punya
 * kontras yang cukup di light/dark tanpa perlu logic tambahan per
 * warna. Nilai disimpan sebagai NAMA (mis. "green"), bukan hex — lookup
 * ke className Tailwind di sini. Dipisah dari `accounts.icon`: bentuk
 * dan warna dipilih independen satu sama lain. Lihat
 * docs/todos/plan/account-icon-picker.md.
 *
 * Shade dan pola tanpa varian `dark:` eksplisit mengikuti yang sudah
 * dipakai untuk income/expense/transfer di transaction-list-item.tsx
 * (`text-green-600`, `text-red-600`, `text-blue-600` polos).
 */
export const ACCOUNT_COLORS: Record<string, { label: string; text: string; bg: string }> = {
  slate: { label: "Abu-abu", text: "text-slate-600", bg: "bg-slate-600" },
  red: { label: "Merah", text: "text-red-600", bg: "bg-red-600" },
  orange: { label: "Oranye", text: "text-orange-600", bg: "bg-orange-600" },
  amber: { label: "Kuning", text: "text-amber-600", bg: "bg-amber-600" },
  green: { label: "Hijau", text: "text-green-600", bg: "bg-green-600" },
  teal: { label: "Teal", text: "text-teal-600", bg: "bg-teal-600" },
  blue: { label: "Biru", text: "text-blue-600", bg: "bg-blue-600" },
  indigo: { label: "Indigo", text: "text-indigo-600", bg: "bg-indigo-600" },
  purple: { label: "Ungu", text: "text-purple-600", bg: "bg-purple-600" },
  pink: { label: "Pink", text: "text-pink-600", bg: "bg-pink-600" },
};

export const ACCOUNT_COLOR_NAMES = Object.keys(ACCOUNT_COLORS);

export const DEFAULT_ACCOUNT_COLOR = "slate";

/** className teks untuk `accounts.color` — fallback ke warna default
 * kalau null atau nama tidak dikenali (mis. dari data lama). */
export function resolveAccountColorText(color: string | null): string {
  if (!color) return ACCOUNT_COLORS[DEFAULT_ACCOUNT_COLOR].text;
  return ACCOUNT_COLORS[color]?.text ?? ACCOUNT_COLORS[DEFAULT_ACCOUNT_COLOR].text;
}
