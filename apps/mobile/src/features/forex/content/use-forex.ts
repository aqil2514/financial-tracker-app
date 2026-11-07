import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useDatabase } from "@/lib/database";
import { getForexAccounts, getForexDetail, type ForexAccountSummary, type ForexDetail } from "@/shared/forex/forex-queries";

export function useForexAccounts() {
  const db = useDatabase();
  const [accounts, setAccounts] = useState<ForexAccountSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      setAccounts(await getForexAccounts(db));
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  return { accounts, isLoading };
}

export function useForexDetail(accountId: string) {
  const db = useDatabase();
  const [detail, setDetail] = useState<ForexDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      setDetail(await getForexDetail(db, accountId));
    } finally {
      setIsLoading(false);
    }
  }, [db, accountId]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  return { detail, isLoading, refetch };
}
