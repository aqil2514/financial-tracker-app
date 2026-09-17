import { APP_LOCALE } from "./locale";

export function formatNumberCompact(value: number) {
  return new Intl.NumberFormat(APP_LOCALE, {
    maximumFractionDigits: 0,
  }).format(value);
}

// Notasi ringkas ("1,2 jt") untuk ruang sempit seperti tick sumbu chart —
// beda dari formatNumberCompact di atas yang tidak memakai notation: "compact".
export function formatCompactNotation(value: number) {
  return new Intl.NumberFormat(APP_LOCALE, {
    notation: "compact",
    compactDisplay: "short",
  }).format(value);
}
