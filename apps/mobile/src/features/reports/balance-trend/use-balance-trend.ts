import { useCallback } from "react";
import { useDatabase } from "@/lib/database";
import { useReportQuery } from "../shared/use-report-query";
import {
  buildOpeningQuery,
  buildSeriesQuery,
  toRunningBalance,
  type BalanceTrendFilter,
  type BalanceTrendPoint,
  type Granularity,
} from "./balance-trend-query";

const EMPTY: BalanceTrendPoint[] = [];

// `filter` harus stabil antar render (state/useMemo di pemanggil) — dipakai sebagai dependensi
// fetcher; kuncinya diturunkan dari isinya supaya isLoading tepat saat argumen berganti.
export function useBalanceTrend(
  from: string,
  to: string,
  granularity: Granularity,
  filter: BalanceTrendFilter
) {
  const db = useDatabase();

  const fetcher = useCallback(async (): Promise<BalanceTrendPoint[]> => {
    const opening = buildOpeningQuery(from, filter);
    const openingRow = await db.getFirstAsync<{ balance: number }>(opening.sql, opening.params);

    const series = buildSeriesQuery(from, to, granularity, filter);
    const rows = await db.getAllAsync<{ point: string; net: number }>(series.sql, series.params);

    return toRunningBalance(openingRow?.balance ?? 0, rows);
  }, [db, from, to, granularity, filter]);

  const key = `${from}|${to}|${granularity}|${JSON.stringify(filter)}`;
  return useReportQuery(key, fetcher, EMPTY);
}
