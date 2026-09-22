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
  extraConditions: ReturnType<typeof extractAttachmentCondition>["extraConditions"]
) =>
  buildWhereClause(filters, FILTERABLE_COLUMNS, [
    ...(date ? [{ condition: "date(date) = $1", params: [date] }] : []),
    ...extraConditions,
  ]);
