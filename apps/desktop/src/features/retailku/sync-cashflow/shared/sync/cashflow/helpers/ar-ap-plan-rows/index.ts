import { extractArApRows } from "../extract-ar-ap-rows";
import { checkedArApPlanRow } from "./checked-ar-ap-plan-row";
import { debtAccountNotConfiguredPlanRow } from "./debt-account-not-configured-plan-row";
import type { getCashflowDetail } from "@/shared/retailku";
import type { ArApSyncPlanRow, Db, SyncCashflowInput } from "../../types";

/** Piutang/utang: akun tujuan dari 2 field existing (BUKAN
 * `retailku_sync_field_mapping`, lihat catatan `SyncCashflowInput`) —
 * kalau salah satu belum diisi user, SEMUA baris arah itu di-skip
 * `debt-account-not-configured` (TIDAK menggagalkan sync cashflow). */
export async function buildArApPlanRows(
  db: Db,
  rows: Awaited<ReturnType<typeof getCashflowDetail>>["data"],
  input: Pick<SyncCashflowInput, "receivableDebtAccountId" | "payableDebtAccountId" | "arApCashAccountId">
): Promise<ArApSyncPlanRow[]> {
  const arApPlanRows: ArApSyncPlanRow[] = [];
  for (const arApRow of extractArApRows(rows)) {
    const debtAccountId =
      arApRow.direction === "receivable" ? input.receivableDebtAccountId : input.payableDebtAccountId;
    if (debtAccountId == null || input.arApCashAccountId == null) {
      arApPlanRows.push(debtAccountNotConfiguredPlanRow(arApRow));
      continue;
    }

    arApPlanRows.push(await checkedArApPlanRow(db, arApRow));
  }
  return arApPlanRows;
}
