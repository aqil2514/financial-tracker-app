export function formatCurrencyShort(amount: number): string {
  if (amount >= 1_000_000_000) return `${trimDecimal(amount / 1_000_000_000)}M`;
  if (amount >= 1_000_000) return `${trimDecimal(amount / 1_000_000)}jt`;
  if (amount >= 1_000) return `${trimDecimal(amount / 1_000)}rb`;
  return amount.toLocaleString("id-ID");
}

function trimDecimal(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "").replace(".", ",");
}
