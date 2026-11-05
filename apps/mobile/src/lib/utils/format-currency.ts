function format(amount: number, maxFractionDigits: number): string {
  const factor = 10 ** maxFractionDigits;
  // `|| 0` mencegah "-Rp0" untuk hasil pembulatan -0.
  const rounded = Math.round(amount * factor) / factor || 0;
  const sign = rounded < 0 ? "-" : "";
  return `${sign}Rp${Math.abs(rounded).toLocaleString("id-ID", { maximumFractionDigits: maxFractionDigits })}`;
}

// Rupiah penuh: sisa pecahan (mis. hasil penjumlahan float) tidak ditampilkan.
export function formatCurrency(amount: number): string {
  return format(amount, 0);
}

// Untuk harga per unit/average cost yang memang bisa berpecahan (investasi).
export function formatCurrencyPrecise(amount: number): string {
  return format(amount, 2);
}
