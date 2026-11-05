import { useCallback } from "react";
import type { SelectOptionsMap } from "@/components/query/filters/panel/panel.interface";
import { useDatabase } from "@/lib/database";
import { useReportQuery } from "@/features/reports/shared/use-report-query";
import {
  buildTransactionFilterOptions,
  STATIC_FILTER_SELECT_OPTIONS,
  type FilterAccountRow,
  type FilterCategoryRow,
} from "./filter-options";

export function useTransactionFilterOptions(): SelectOptionsMap {
  const db = useDatabase();

  const fetcher = useCallback(async () => {
    const categories = await db.getAllAsync<FilterCategoryRow>(
      `SELECT c.id, c.name, p.name AS parent_name
       FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
       ORDER BY COALESCE(p.name, c.name) ASC, p.name IS NOT NULL, c.name ASC`
    );
    const accounts = await db.getAllAsync<FilterAccountRow>(
      `SELECT id, name, is_active FROM accounts ORDER BY name ASC`
    );
    return buildTransactionFilterOptions(categories, accounts);
  }, [db]);

  return useReportQuery("transaction-filter-options", fetcher, STATIC_FILTER_SELECT_OPTIONS).data;
}
