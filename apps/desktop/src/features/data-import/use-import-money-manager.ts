"use client";

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { accountsQueryKey } from "@/features/accounts";
import { accountGroupsQueryKey } from "@/features/account-groups";
import { categoriesQueryKey } from "@/features/categories";
import { transactionsQueryKey } from "@/features/transactions";

export type ImportSummary = {
  account_groups: number;
  accounts: number;
  categories: number;
  transactions: number;
  income: number;
  expense: number;
  transfer: number;
  unresolved_accounts: number;
  unresolved_categories: number;
  unmatched_transfers: number;
};

export function useImportMoneyManager() {
  const queryClient = useQueryClient();
  const [filePath, setFilePath] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  async function pickFile() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Money Manager Backup", extensions: ["mmbak"] }],
    });
    if (!selected || Array.isArray(selected)) return;

    setFilePath(selected);
    setSummary(null);
    setIsPreviewing(true);
    try {
      const result = await invoke<ImportSummary>("import_money_manager", {
        sourcePath: selected,
        dryRun: true,
      });
      setSummary(result);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      toast.error(`Gagal membaca file backup: ${detail}`);
      setFilePath(null);
    } finally {
      setIsPreviewing(false);
    }
  }

  async function confirmImport() {
    if (!filePath) return;

    setIsImporting(true);
    try {
      const result = await invoke<ImportSummary>("import_money_manager", {
        sourcePath: filePath,
        dryRun: false,
      });
      toast.success(
        `Berhasil mengimpor ${result.transactions} transaksi, ${result.accounts} akun, ${result.categories} kategori`
      );
      queryClient.invalidateQueries({ queryKey: accountsQueryKey });
      queryClient.invalidateQueries({ queryKey: accountGroupsQueryKey });
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
      queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
      reset();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      toast.error(`Gagal mengimpor data: ${detail}`);
    } finally {
      setIsImporting(false);
    }
  }

  function reset() {
    setFilePath(null);
    setSummary(null);
  }

  return {
    filePath,
    summary,
    isPreviewing,
    isImporting,
    pickFile,
    confirmImport,
    reset,
  };
}
