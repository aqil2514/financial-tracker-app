import { buildWhereClause } from "@/components/query/filters/builders/sql";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { extractAttachmentCondition } from "./extract-attachment-condition";

const FILTERABLE_COLUMNS = [
  "note",
  "description",
  "type",
  "category_id",
  "account_id",
  "amount",
] as const;

export const buildWhereConditions = (
  filters: FilterConfig[],
  date: string | undefined,
  extraConditions: ReturnType<typeof extractAttachmentCondition>["extraConditions"],
  accountId?: number,
  dateRange?: { from: string; to: string }
) => {
  const dateCondition = date ? [{ condition: "date(date) = $1", params: [date] }] : [];

  // `date` (exact, dari kalender) dan `dateRange` (dari PeriodPicker)
  // SALING EKSKLUSIF secara pemakaian nyata (kalender vs picker periode
  // beda halaman) — tapi tidak dipaksa exclusive di sini, keduanya boleh
  // aktif sekaligus (AND) kalau caller memang mengirim keduanya. `$N`
  // dihitung relatif terhadap `dateCondition` supaya tidak bentrok kalau
  // keduanya aktif bersamaan.
  const dateRangeCondition = dateRange
    ? (() => {
        const startIndex = dateCondition.length + 1;
        return [
          {
            condition: `date(date) BETWEEN $${startIndex} AND $${startIndex + 1}`,
            params: [dateRange.from, dateRange.to],
          },
        ];
      })()
    : [];

  // `$N` di sini dihitung manual berdasarkan posisi dalam array, bukan
  // lewat nextIndex() (itu baru jalan di dalam buildWhereClause) — makanya
  // ditempatkan PALING TERAKHIR di antara extraConditions supaya nomornya
  // pasti benar tanpa perlu tahu ada berapa extraConditions lain sebelumnya.
  const accountCondition =
    accountId != null
      ? (() => {
          const startIndex =
            dateCondition.length + dateRangeCondition.length + extraConditions.length + 1;
          return [
            {
              condition: `(account_id = $${startIndex} OR transfer_account_id = $${startIndex + 1})`,
              params: [accountId, accountId],
            },
          ];
        })()
      : [];

  return buildWhereClause(filters, FILTERABLE_COLUMNS, [
    ...dateCondition,
    ...dateRangeCondition,
    ...extraConditions,
    ...accountCondition,
  ]);
};
