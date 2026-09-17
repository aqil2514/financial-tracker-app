export type SupportedCurrency = "IDR" | "USD" | "EUR" | "SGD" | "JPY";

// Locale asli tiap mata uang — angka diformat sesuai konvensi mata uang
// itu sendiri (pemisah desimal, posisi simbol, dst), bukan dipaksa satu
// locale untuk semua supaya nominal tidak salah dibaca.
const CURRENCY_LOCALE: Record<SupportedCurrency, string> = {
  IDR: "id-ID",
  USD: "en-US",
  EUR: "de-DE",
  SGD: "en-SG",
  JPY: "ja-JP",
};

export function formatCurrency(value: number, currency: SupportedCurrency) {
  const locale = CURRENCY_LOCALE[currency] ?? "en-US";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
