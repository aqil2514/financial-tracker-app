import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useDatabase } from "@/lib/database";
import {
  getThirdPartyAccounts,
  getThirdPartyFundHistory,
  getThirdPartySummary,
  type ThirdPartyAccountSummary,
  type ThirdPartyFundHistoryRow,
  type ThirdPartySummaryRow,
} from "@/shared/third-party-funds";

export function useThirdPartyData() {
  const db = useDatabase();
  const [accounts, setAccounts] = useState<ThirdPartyAccountSummary[]>([]);
  const [summary, setSummary] = useState<ThirdPartySummaryRow[]>([]);
  const [history, setHistory] = useState<ThirdPartyFundHistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextAccounts, nextSummary, nextHistory] = await Promise.all([
        getThirdPartyAccounts(db),
        getThirdPartySummary(db),
        getThirdPartyFundHistory(db),
      ]);
      setAccounts(nextAccounts);
      setSummary(nextSummary);
      setHistory(nextHistory);
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  return { accounts, summary, history, isLoading, refetch };
}
