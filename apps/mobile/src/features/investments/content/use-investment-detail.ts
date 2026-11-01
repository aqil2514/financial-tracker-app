import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useDatabase } from "@/lib/database";
import { getInvestmentDetail, type InvestmentDetail } from "@/shared/investments";

export function useInvestmentDetail(accountId: string) {
  const db = useDatabase();
  const [detail, setDetail] = useState<InvestmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      setDetail(await getInvestmentDetail(db, accountId));
    } finally {
      setIsLoading(false);
    }
  }, [db, accountId]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  return { detail, isLoading };
}
