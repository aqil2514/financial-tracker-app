import type { ArApCashAccount } from "./extract-ar-ap-rows";
import type { RetailkuCashflowSyncMode } from "../../use-retailku-cashflow-sync-settings";
import type { RetailkuSyncFieldMappingRow } from "../types";

export type ResolvedArApCashAccount = {
  accountId: string;
  accountName: string;
  amount: number;
  key: string;
  localAccountId: string | null;
};

function buildLookupKey(
  mode: RetailkuCashflowSyncMode,
  accountId: string,
  sourceType: string | null,
  amount: number
): string {
  const direction = amount >= 0 ? "inflow" : "outflow";
  if (mode === "summary") return `summary:${direction}:${accountId}`;
  return `detail:${accountId}:${sourceType ?? "LAINNYA"}:${direction}`;
}

export function resolveArApCashAccounts(
  cashAccounts: ArApCashAccount[],
  sourceType: string | null,
  mode: RetailkuCashflowSyncMode,
  fieldMapping: Map<string, RetailkuSyncFieldMappingRow>
): ResolvedArApCashAccount[] {
  return cashAccounts.map((cashAccount) => {
    const key = buildLookupKey(mode, cashAccount.accountId, sourceType, cashAccount.amount);
    const mapped = fieldMapping.get(key);
    return {
      accountId: cashAccount.accountId,
      accountName: cashAccount.accountName,
      amount: cashAccount.amount,
      key,
      localAccountId: mapped?.localAccountId ?? null,
    };
  });
}
