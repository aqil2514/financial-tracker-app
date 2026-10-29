import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useDatabase } from "@/lib/database";
import { getContactSummary, type ContactDebtSummary } from "@/shared/debts";

export function useContactSummary() {
  const db = useDatabase();
  const [summary, setSummary] = useState<ContactDebtSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await getContactSummary(db);
      setSummary(rows);
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  return { summary, isLoading };
}
