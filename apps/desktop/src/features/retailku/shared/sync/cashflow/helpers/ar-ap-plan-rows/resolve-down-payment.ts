import type { ArApRow } from "../extract-ar-ap-rows";
import type { RetailkuCashflowSyncMode } from "../../../use-retailku-cashflow-sync-settings";
import type { RetailkuSyncFieldMappingRow } from "../../types";

export type ResolvedDownPayment = {
  amount: number;
  localAccountId: string;
  note: string;
  categoryId: string | null;
  description: string | null;
};

function buildLookupKey(mode: RetailkuCashflowSyncMode, accountId: string, sourceType: string | null): string {
  if (mode === "summary") return `summary:inflow:${accountId}`;
  return `detail:${accountId}:${sourceType ?? "LAINNYA"}:inflow`;
}

// DP/uang muka yang diterima BERSAMAAN piutang/utang baru tercipta —
// row.amount SUDAH net (piutang residual setelah DP dikurangi), lihat
// docs/todos/plan/retailku-ar-ap-negative-amount-settlement.md. Data
// nyata Warung Aqil (27 baris DP murni tersedia): SELALU tepat 1
// cashAccount, SELALU positif (kas MASUK) — kasus cashAccounts negatif
// (kas keluar, mis. talangan LEDGER_ENTRY) atau campuran +/- (payout
// PPOB) BUKAN pola ini, sengaja diabaikan (scope dikonfirmasi user).
// Dipakai KHUSUS baris willInsert/willUpdate (piutang/utang BARU),
// TIDAK berlaku baris pelunasan (beda konsep, lihat
// resolve-payment-account-id.ts).
export function resolveDownPayment(
  row: ArApRow,
  fieldMapping: Map<string, RetailkuSyncFieldMappingRow>,
  mode: RetailkuCashflowSyncMode
): ResolvedDownPayment | null {
  if (row.cashAccounts.length !== 1) return null;
  const [cashAccount] = row.cashAccounts;
  if (cashAccount.amount <= 0) return null;

  const key = buildLookupKey(mode, cashAccount.accountId, row.sourceType);
  const mapping = fieldMapping.get(key);
  if (mapping == null) return null;

  return {
    amount: cashAccount.amount,
    localAccountId: mapping.localAccountId,
    note: mapping.note ?? `Kas Harian Retailku — ${cashAccount.accountName} — ${row.sourceType ?? "LAINNYA"} (DP)`,
    categoryId: mapping.categoryId,
    description: mapping.description,
  };
}
