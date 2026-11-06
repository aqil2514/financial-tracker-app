import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useDatabase } from "@/lib/database";
import type { LabelListItem } from "../types";

export function useLabels() {
  const db = useDatabase();
  const [labels, setLabels] = useState<LabelListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      setLabels(
        await db.getAllAsync<LabelListItem>(`SELECT id, name, scope FROM labels ORDER BY name ASC`)
      );
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  return { labels, isLoading, refetch };
}
