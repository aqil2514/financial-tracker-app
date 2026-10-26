export function formatCurrency(amount: number) {
  return `Rp${amount.toLocaleString("id-ID")}`;
}