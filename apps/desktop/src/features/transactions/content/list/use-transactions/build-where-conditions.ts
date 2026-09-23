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
  accountId?: number
) => {
  const dateCondition = date ? [{ condition: "date(date) = $1", params: [date] }] : [];

  // `$N` di sini dihitung manual berdasarkan posisi dalam array, bukan
  // lewat nextIndex() (itu baru jalan di dalam buildWhereClause) — makanya
  // ditempatkan PALING TERAKHIR di antara extraConditions supaya nomornya
  // pasti benar tanpa perlu tahu ada berapa extraConditions lain sebelumnya.
  const accountCondition =
    accountId != null
      ? (() => {
          const startIndex = dateCondition.length + extraConditions.length + 1;
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
    ...extraConditions,
    ...accountCondition,
  ]);
};
