import type { AggregatedTotal, RetailkuSyncFieldMappingRow } from "../../types";

/** Gabungkan `total` hasil agregasi dengan mapping tersimpan — `note`
 * fallback ke template default (dari fungsi agregasi) kalau user
 * belum atur mapping-nya, fallback PER KOLOM bukan per baris (lihat
 * "Field fallback default" di dokumen plan). */
export function resolveMappedTotal(total: AggregatedTotal, mapping: RetailkuSyncFieldMappingRow) {
  return {
    ...total,
    note: mapping.note ?? total.note,
    categoryId: mapping.categoryId,
    description: mapping.description,
  };
}
