import { useMemo, useState } from "react";

import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SelectOptionsMap } from "@/components/query/filters/panel/panel.interface";
import type { SortConfig } from "@/components/query/sort";
import type { AccountWithBalance } from "@/features/accounts";
import type { Category } from "@/lib/db";
import { STATIC_FILTER_SELECT_OPTIONS } from "../constants";
import type { ListContextFilter } from "../interface";

export function useListFilter(
  categories: Category[] | undefined,
  accounts: AccountWithBalance[] | undefined
): ListContextFilter {
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [sorts, setSorts] = useState<SortConfig[]>([]);
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | undefined>();

  const filterSelectOptions = useMemo<SelectOptionsMap>(
    () => ({
      ...STATIC_FILTER_SELECT_OPTIONS,
      category_id: (categories ?? []).map((category) => ({
        value: String(category.id),
        label: category.name,
      })),
      account_id: (accounts ?? []).map((account) => ({
        value: String(account.id),
        label: account.name,
      })),
    }),
    [categories, accounts]
  );

  return { filters, setFilters, filterSelectOptions, sorts, setSorts, dateRange, setDateRange };
}
