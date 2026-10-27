import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useDatabase } from "@/lib/database";
import type { CategoryPeriodListItem } from "../types";

interface CategoryPeriodRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  category_names: string;
  is_ongoing: number;
}

function toListItem(row: CategoryPeriodRow): CategoryPeriodListItem {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    categoryNames: row.category_names,
    isOngoing: row.is_ongoing === 1,
  };
}

// Query ulang tiap halaman Periode Kategori mendapat fokus — pola sama
// use-categories.ts/use-transactions.ts, tanpa React Query. is_ongoing
// dihitung dari date('now') BETWEEN start_date AND end_date (konsisten
// dengan hooks/use-category-periods.ts di desktop).
export function useCategoryPeriods() {
  const db = useDatabase();
  const [periods, setPeriods] = useState<CategoryPeriodListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await db.getAllAsync<CategoryPeriodRow>(
        `SELECT category_periods.*,
                GROUP_CONCAT(categories.name, ', ') as category_names,
                (date('now') BETWEEN category_periods.start_date AND category_periods.end_date) as is_ongoing
         FROM category_periods
         JOIN category_period_categories ON category_period_categories.period_id = category_periods.id
         JOIN categories ON categories.id = category_period_categories.category_id
         GROUP BY category_periods.id
         ORDER BY is_ongoing DESC, category_periods.start_date DESC`
      );
      setPeriods(rows.map(toListItem));
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  return { periods, isLoading, refetch };
}
