import { connectRetailkuMcp } from "@/shared/retailku";
import { aggregateByDateAccountAndSourceType } from "./helpers/aggregate-by-date-account-and-source-type";
import { aggregateByDateAndAccount } from "./helpers/aggregate-by-date-and-account";
import { fetchAllCashflowDetailRows } from "./helpers/fetch-all-cashflow-detail-rows";
import { isPeriodSynced } from "./helpers/is-period-synced";
import { loadAccountMapping } from "./helpers/load-account-mapping";
import { loadActivePaymentMethodIds } from "./helpers/load-active-payment-method-ids";
import type { CashflowSyncPlan, CashflowSyncPlanRow, Db, SyncCashflowInput } from "./types";

/**
 * Hitung APA yang akan disinkronkan (fetch MCP + agregasi + cek
 * mapping/idempotency/status payment method) TANPA menulis apa pun ke
 * database — dipakai BAIK oleh `syncCashflow` (lanjut insert) MAUPUN
 * oleh preview (`use-preview-sync.ts`, baca-saja). Dipisah dari
 * `syncCashflow` supaya preview tidak perlu insert+rollback cuma untuk
 * menghitung hasilnya lebih dulu.
 *
 * Termasuk validasi POINT-OF-USE (defense in depth, lihat
 * "Stabilitas retailku_account_id" di retailku-account-mapping.md):
 * mapping tersimpan bisa saja menunjuk akun yang SEJAK di-mapping sudah
 * dinonaktifkan sebagai payment method di Retailku
 * (`isPaymentMethod: false`, lihat `pm-deactivate.helper.ts` di
 * retail-multitenant) — TANPA validasi ulang ini, sync akan diam-diam
 * tetap memasukkan transaksi ke mapping yang sudah tidak valid lagi di
 * sisi Retailku.
 */
export async function computeCashflowSync(
  db: Db,
  input: Pick<SyncCashflowInput, "mcpConfig" | "dateFrom" | "dateTo" | "timezone" | "mode">
): Promise<CashflowSyncPlan> {
  const client = await connectRetailkuMcp(input.mcpConfig);
  try {
    const rows = await fetchAllCashflowDetailRows(client, input);
    const accountMap = await loadAccountMapping(db);
    const activePaymentMethodIds = await loadActivePaymentMethodIds(client);

    const totals =
      input.mode === "summary"
        ? aggregateByDateAndAccount(rows)
        : aggregateByDateAccountAndSourceType(rows);

    const planRows: CashflowSyncPlanRow[] = [];
    const unmappedAccountIds = new Set<string>();
    const deactivatedPaymentMethodAccountIds = new Set<string>();

    for (const total of totals) {
      if (total.net === 0) continue;

      const localAccountId = accountMap.get(total.retailkuAccountId) ?? null;
      if (localAccountId == null) {
        unmappedAccountIds.add(total.retailkuAccountId);
        planRows.push({ ...total, willInsert: false, skipReason: "unmapped-account", localAccountId: null });
        continue;
      }

      if (!activePaymentMethodIds.has(total.retailkuAccountId)) {
        deactivatedPaymentMethodAccountIds.add(total.retailkuAccountId);
        planRows.push({
          ...total,
          willInsert: false,
          skipReason: "deactivated-payment-method",
          localAccountId,
        });
        continue;
      }

      const alreadySynced = await isPeriodSynced(db, total.date, total.retailkuAccountId);
      if (alreadySynced) {
        planRows.push({ ...total, willInsert: false, skipReason: "already-synced", localAccountId });
        continue;
      }

      planRows.push({ ...total, willInsert: true, skipReason: null, localAccountId });
    }

    return {
      rows: planRows,
      unmappedAccountIds: [...unmappedAccountIds],
      deactivatedPaymentMethodAccountIds: [...deactivatedPaymentMethodAccountIds],
    };
  } finally {
    await client.close();
  }
}
