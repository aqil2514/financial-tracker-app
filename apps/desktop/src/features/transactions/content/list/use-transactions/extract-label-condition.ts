import type { ExtraCondition } from "@/components/query/filters/builders/sql";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import { buildEffectiveLabelSubquery } from "@/shared/labels/effective-label-subquery";

/**
 * `label` bukan kolom asli `transactions` (nilai efektifnya hasil
 * fallback transaksi->kategori lewat tabel label terpisah, lihat
 * shared/labels/effective-label-subquery.ts) -- disaring di sini dan
 * diterjemahkan jadi EXISTS subquery lewat `extraConditions`, pola
 * SAMA PERSIS extract-attachment-condition.ts.
 *
 * Semantik OR/union (keputusan 2026-10-10): pilih label "Konsumtif" +
 * "Produktif" di filter -> tampilkan transaksi yang efektifnya SALAH
 * SATU dari keduanya, BUKAN harus punya kedua label sekaligus.
 *
 * `startIndex` -- posisi numbered placeholder ($N) pertama yang BOLEH
 * dipakai kondisi ini, SAMA kontraknya dgn `buildWhereClause` (lihat
 * builders/sql.ts). Dibutuhkan eksplisit (bukan selalu mulai dari $1)
 * karena filter `label` di sini TIDAK SELALU jadi extraCondition
 * PERTAMA -- `has_attachment` (extract-attachment-condition.ts) sudah
 * lebih dulu diproses di pipeline use-transactions/index.ts.
 */
export function extractLabelCondition(
  filters: FilterConfig[],
  startIndex: number
): {
  remaining: FilterConfig[];
  extraConditions: ExtraCondition[];
} {
  const remaining: FilterConfig[] = [];
  const extraConditions: ExtraCondition[] = [];

  for (const filter of filters) {
    if (filter.filterKey !== "label") {
      remaining.push(filter);
      continue;
    }

    // Operator "Kosong"/"Tidak kosong" -- tidak ada label efektif sama
    // sekali (transaksi TIDAK punya label eksplisit DAN kategorinya juga
    // tidak punya/transaksi tidak berkategori), bukan "tidak match nama
    // tertentu". Tidak butuh params/placeholder nama sama sekali --
    // nameFilter "" berarti "ada label efektif apa pun" (lihat
    // effective-label-subquery.ts).
    if (filter.filterOperator === "is_null" || filter.filterOperator === "is_not_null") {
      const notPrefix = filter.filterOperator === "is_null" ? "NOT " : "";
      extraConditions.push({ condition: `${notPrefix}${buildEffectiveLabelSubquery("")}` });
      continue;
    }

    const names = Array.isArray(filter.filterValue)
      ? filter.filterValue.map(String)
      : filter.filterValue != null
        ? [String(filter.filterValue)]
        : [];
    if (names.length === 0) continue;

    // "eq" (Adalah) -> OR/union semantics (keputusan 2026-10-10): match
    // SALAH SATU nama yang dipilih. "neq" (Bukan) -> NOT dari subquery
    // yang sama (tidak match SATU PUN nama yang dipilih), bukan sekadar
    // negasi per-nama -- konsisten dgn makna "Bukan [label2, label3]"
    // sbg "tidak termasuk label2 ataupun label3".
    const placeholders = names.map((_, i) => `$${startIndex + i}`).join(", ");
    const notPrefix = filter.filterOperator === "neq" ? "NOT " : "";
    extraConditions.push({
      condition: `${notPrefix}${buildEffectiveLabelSubquery(placeholders)}`,
      // `placeholders` dipakai 2x di dalam subquery (cabang transaksi
      // eksplisit DAN cabang fallback kategori) -- numbered placeholder
      // SQLite di-resolve berdasarkan NOMORNYA (bukan posisi tekstual),
      // jadi params cukup dikirim SEKALI per nama label, tidak perlu
      // digandakan walau tertulis 2x di SQL (lihat catatan serupa di
      // run-transactions-queries.ts soal numbered placeholder).
      params: names,
    });
  }

  return { remaining, extraConditions };
}
