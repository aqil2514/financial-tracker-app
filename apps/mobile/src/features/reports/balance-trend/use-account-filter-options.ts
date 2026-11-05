import { useCallback } from "react";
import type { SelectOptionsMap } from "@/components/query/filters/panel/panel.interface";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/account-types";
import { useDatabase } from "@/lib/database";
import { useReportQuery } from "../shared/use-report-query";

const EMPTY: SelectOptionsMap = {};

// Pilihan nilai untuk filter akun Tren Keuangan (tipe, grup, akun). Akun nonaktif tetap
// bisa dipilih dan diberi tanda "(Nonaktif)", sama seperti desktop.
export function useAccountFilterOptions(): SelectOptionsMap {
  const db = useDatabase();

  const fetcher = useCallback(async (): Promise<SelectOptionsMap> => {
    const groups = await db.getAllAsync<{ id: string; name: string }>(
      `SELECT id, name FROM account_groups ORDER BY name ASC`
    );
    const accounts = await db.getAllAsync<{ id: string; name: string; is_active: number }>(
      `SELECT id, name, is_active FROM accounts ORDER BY name ASC`
    );

    return {
      account_type: Object.entries(ACCOUNT_TYPE_OPTIONS).map(([value, option]) => ({
        value,
        label: option.label,
      })),
      group_id: groups.map((group) => ({ value: group.id, label: group.name })),
      account_id: accounts.map((account) => ({
        value: account.id,
        label: account.is_active ? account.name : `${account.name} (Nonaktif)`,
      })),
    };
  }, [db]);

  return useReportQuery("account-filter-options", fetcher, EMPTY).data;
}
