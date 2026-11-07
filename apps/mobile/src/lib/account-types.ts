export const ACCOUNT_TYPE_OPTIONS: Record<
  "cash" | "debt" | "investment" | "third_party" | "forex",
  { label: string; badgeBg: string; badgeText: string }
> = {
  cash: { label: "Kas", badgeBg: "bg-green-100", badgeText: "text-green-700" },
  debt: { label: "Utang Piutang", badgeBg: "bg-red-100", badgeText: "text-red-700" },
  investment: { label: "Investasi", badgeBg: "bg-blue-100", badgeText: "text-blue-700" },
  third_party: { label: "Dana Pihak Ketiga", badgeBg: "bg-amber-100", badgeText: "text-amber-700" },
  forex: { label: "Valas", badgeBg: "bg-teal-100", badgeText: "text-teal-700" },
};
