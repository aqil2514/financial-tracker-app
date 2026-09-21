import { APP_LOCALE } from "./locale";

type DateStyle = "month-label" | "date-time" | "date-only";

const DATE_STYLE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  "month-label": { month: "short", year: "2-digit" },
  "date-time": { dateStyle: "medium", timeStyle: "short" },
  "date-only": { dateStyle: "medium" },
};

// Satu fungsi format tanggal untuk semua kebutuhan tampilan — style baru
// tinggal ditambah di DATE_STYLE_OPTIONS, bukan bikin fungsi Intl baru lagi.
// `locale` opsional, default ke locale aplikasi (lihat locale.ts) — override
// hanya untuk kasus khusus (mis. testing atau tampilan lintas-locale).
export function formatDate(value: string, style: DateStyle, locale: string = APP_LOCALE) {
  if (style === "month-label") {
    const [year, monthNum] = value.split("-");
    const date = new Date(Number(year), Number(monthNum) - 1);
    return new Intl.DateTimeFormat(locale, DATE_STYLE_OPTIONS[style]).format(date);
  }

  const hasTime = value.includes("T");
  const date = new Date(hasTime ? value : `${value}T00:00`);
  const { dateStyle } = DATE_STYLE_OPTIONS[style];

  return new Intl.DateTimeFormat(locale, {
    dateStyle,
    timeStyle: style === "date-time" && hasTime ? "short" : undefined,
  }).format(date);
}
