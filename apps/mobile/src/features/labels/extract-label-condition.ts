import type { ExtraCondition } from "@/components/query/filters/builders/sql";
import type { FilterConfig } from "@/components/query/filters/filter.interface";

// Label efektif transaksi: label miliknya sendiri; kalau transaksi tidak punya satu pun, pakai label kategorinya
// (sama dengan apps/desktop/src/shared/labels/effective-label-subquery.ts). Tanpa cek deleted_at karena di mobile
// label dan pemasangannya dihapus permanen. Placeholder `?` langsung, jadi nama dikirim dua kali (dua cabang).
function effectiveLabelSubquery(namePlaceholders: string) {
  const nameCondition = namePlaceholders ? `AND l.name IN (${namePlaceholders})` : "";
  return `(
    EXISTS (
      SELECT 1 FROM transaction_labels tl
      JOIN labels l ON l.id = tl.label_id
      WHERE tl.transaction_id = transactions.id ${nameCondition}
    )
    OR (
      NOT EXISTS (SELECT 1 FROM transaction_labels tl2 WHERE tl2.transaction_id = transactions.id)
      AND EXISTS (
        SELECT 1 FROM category_labels cl
        JOIN labels l ON l.id = cl.label_id
        WHERE cl.category_id = transactions.category_id ${nameCondition}
      )
    )
  )`;
}

// `label` bukan kolom `transactions`, jadi disaring dari filter dan diubah jadi kondisi EXISTS lewat extraConditions.
// Beberapa nama = salah satu cocok (OR), bukan harus punya semuanya; "Bukan" = tidak cocok satu pun.
export function extractLabelCondition(filters: FilterConfig[]): {
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

    if (filter.filterOperator === "is_null" || filter.filterOperator === "is_not_null") {
      const notPrefix = filter.filterOperator === "is_null" ? "NOT " : "";
      extraConditions.push({ condition: `${notPrefix}${effectiveLabelSubquery("")}` });
      continue;
    }

    const names = Array.isArray(filter.filterValue)
      ? filter.filterValue.map(String)
      : filter.filterValue != null
        ? [String(filter.filterValue)]
        : [];
    if (names.length === 0) continue;

    const placeholders = names.map(() => "?").join(", ");
    const notPrefix = filter.filterOperator === "neq" ? "NOT " : "";
    extraConditions.push({
      condition: `${notPrefix}${effectiveLabelSubquery(placeholders)}`,
      params: [...names, ...names],
    });
  }

  return { remaining, extraConditions };
}
