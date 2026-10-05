import { APP_LOCALE } from "./locale";

type DateStyle = "month-label" | "date-time" | "date-only" | "full-date" | "time-only";

const DATE_STYLE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  "month-label": { month: "short", year: "2-digit" },
  "date-time": { dateStyle: "medium", timeStyle: "short" },
  "date-only": { dateStyle: "medium" },
  // `weekday` tak bisa digabung dengan `dateStyle` di Intl -- harus di-spell
  // manual. Dipakai sebagai header pemisah grup tanggal di list transaksi.
  "full-date": { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  "time-only": { timeStyle: "short" },
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

  // `created_at` datang dari SQLite `datetime('now')` -- "YYYY-MM-DD
  // HH:mm:ss" (spasi, bukan "T") -- sementara `date` transaksi pakai "T"
  // (lihat use-create-transaction.ts / mcp-server date-field.ts). Normalisasi
  // ke "T" dulu supaya `new Date()` tidak mem-parsing jadi Invalid Date.
  const hasTime = /[T ]\d{2}:\d{2}/.test(value);
  const normalized = hasTime ? value.replace(" ", "T") : value;
  const date = new Date(hasTime ? normalized : `${normalized}T00:00`);

  if (style === "full-date") {
    return new Intl.DateTimeFormat(locale, DATE_STYLE_OPTIONS[style]).format(date);
  }

  if (style === "time-only") {
    return hasTime ? new Intl.DateTimeFormat(locale, DATE_STYLE_OPTIONS[style]).format(date) : "";
  }

  const { dateStyle } = DATE_STYLE_OPTIONS[style];

  return new Intl.DateTimeFormat(locale, {
    dateStyle,
    timeStyle: style === "date-time" && hasTime ? "short" : undefined,
  }).format(date);
}
