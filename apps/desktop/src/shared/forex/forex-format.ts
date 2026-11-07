// Kurs dan unit valas bisa berdesimal, beda dari formatCurrency (dibulatkan ke rupiah utuh).
const rateFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const unitFormatter = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 });

export function formatRate(value: number) {
  return rateFormatter.format(value);
}

export function formatForexUnit(value: number, currency: string) {
  return `${unitFormatter.format(value)} ${currency}`;
}
