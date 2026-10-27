import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useDatabase } from "@/lib/database";
import { CategoryListItem } from "../types";

interface CategoryRow {
  id: string;
  name: string;
  type: "income" | "expense";
  parent_id: string | null;
  is_active: number;
}

function toListItem(row: CategoryRow): CategoryListItem {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    parentId: row.parent_id,
    isActive: row.is_active === 1,
  };
}

export function useCategories() {
  const db = useDatabase();
  const [categories, setCategories] = useState<CategoryListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await db.getAllAsync<CategoryRow>(
        `SELECT id, name, type, parent_id, is_active FROM categories ORDER BY name ASC`
      );
      setCategories(rows.map(toListItem));
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const toggleActive = useCallback(
    async (id: string, nextIsActive: boolean) => {
      await db.runAsync(`UPDATE categories SET is_active = ? WHERE id = ?`, [
        nextIsActive ? 1 : 0,
        id,
      ]);
      await refetch();
    },
    [db, refetch]
  );

  return { categories, isLoading, refetch, toggleActive };
}
