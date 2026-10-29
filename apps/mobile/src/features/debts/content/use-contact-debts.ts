import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useDatabase } from "@/lib/database";
import { getContactDebts, type ContactDebtRow } from "@/shared/debts";

export function useContactDebts(contactId: string) {
  const db = useDatabase();
  const [debts, setDebts] = useState<ContactDebtRow[] | null>(null);

  const refetch = useCallback(async () => {
    const rows = await getContactDebts(db, contactId);
    setDebts(rows);
  }, [db, contactId]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  return { debts, isLoading: debts === null };
}
