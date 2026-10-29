import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useDatabase } from "@/lib/database";
import { getDebtsList, type DebtListRow } from "@/shared/debts";

export function useDebtsList() {
  const db = useDatabase();
  const [debts, setDebts] = useState<DebtListRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await getDebtsList(db);
      setDebts(rows);
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  return { debts, isLoading, refetch };
}
