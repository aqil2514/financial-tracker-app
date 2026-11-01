import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useDatabase } from "@/lib/database";
import { getInvestmentAccounts, type InvestmentAccountSummary } from "@/shared/investments";

export function useInvestmentAccounts() {
  const db = useDatabase();
  const [accounts, setAccounts] = useState<InvestmentAccountSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      setAccounts(await getInvestmentAccounts(db));
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
