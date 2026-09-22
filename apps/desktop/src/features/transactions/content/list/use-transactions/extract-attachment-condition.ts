import type { ExtraCondition } from "@/components/query/filters/builders/sql";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import { HAS_ATTACHMENT_SUBQUERY } from "./interface";

/**
 * `has_attachment` bukan kolom asli `transactions` (lampiran ada di tabel
 * terpisah `transaction_attachments`), jadi tidak bisa lewat
 * `buildWhereClause` generik yang mengasumsikan `filterKey` = nama kolom.
 * Disaring lebih dulu di sini dan diterjemahkan jadi kondisi
 * EXISTS/NOT EXISTS lewat `extraConditions`, sebelum sisa filter lain
 * diproses seperti biasa.
 */
export function extractAttachmentCondition(filters: FilterConfig[]): {
  remaining: FilterConfig[];
  extraConditions: ExtraCondition[];
} {
  const remaining: FilterConfig[] = [];
  const extraConditions: ExtraCondition[] = [];

  for (const filter of filters) {
    if (filter.filterKey !== "has_attachment") {
      remaining.push(filter);
      continue;
    }

    const values = Array.isArray(filter.filterValue)
      ? filter.filterValue.map(String)
      : filter.filterValue != null
        ? [String(filter.filterValue)]
        : [];
    // Dua nilai sekaligus (Ada + Tidak ada) berarti tidak memfilter apa-apa.
    if (values.length !== 1) continue;

    extraConditions.push({
      condition: values[0] === "1" ? HAS_ATTACHMENT_SUBQUERY : `NOT ${HAS_ATTACHMENT_SUBQUERY}`,
    });
  }

  return { remaining, extraConditions };
}
