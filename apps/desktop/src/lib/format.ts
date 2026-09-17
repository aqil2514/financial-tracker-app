export function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumberCompact(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(value: string) {
  const hasTime = value.includes("T");
  const date = new Date(hasTime ? value : `${value}T00:00`);

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: hasTime ? "short" : undefined,
  }).format(date);
}
