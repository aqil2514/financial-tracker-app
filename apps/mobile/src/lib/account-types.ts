export const ACCOUNT_TYPE_OPTIONS: Record<
  "cash" | "debt",
  { label: string; badgeBg: string; badgeText: string }
> = {
  cash: { label: "Kas", badgeBg: "bg-green-100", badgeText: "text-green-700" },
  debt: { label: "Utang Piutang", badgeBg: "bg-red-100", badgeText: "text-red-700" },
};
