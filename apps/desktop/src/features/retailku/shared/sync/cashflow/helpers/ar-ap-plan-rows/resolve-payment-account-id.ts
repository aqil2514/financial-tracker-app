import { resolveArApCashAccounts } from "../resolve-ar-ap-cash-account";
import type { ArApRow } from "../extract-ar-ap-rows";
import type { RetailkuCashflowSyncMode } from "../../../use-retailku-cashflow-sync-settings";
import type { RetailkuSyncFieldMappingRow } from "../../types";

// NULL kalau row.cashAccounts bukan tepat 1 elemen (0 atau >1 — split
// kas belum pernah terjadi di data nyata, lihat handover) atau kalau
// elemen itu belum dipetakan ke akun lokal (localAccountId null).
export function resolvePaymentAccountId(
  row: ArApRow,
  fieldMapping: Map<string, RetailkuSyncFieldMappingRow>,
  mode: RetailkuCashflowSyncMode
): string | null {
  if (row.cashAccounts.length !== 1) return null;
  const [resolved] = resolveArApCashAccounts(row.cashAccounts, row.sourceType, mode, fieldMapping);
  return resolved.localAccountId;
}
