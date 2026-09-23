import { connectRetailkuMcp } from "@/shared/retailku";
import { aggregateByDateAccountAndSourceType } from "./helpers/aggregate-by-date-account-and-source-type";
import { aggregateByDateAndAccount } from "./helpers/aggregate-by-date-and-account";
import { fetchAllCashflowDetailRows } from "./helpers/fetch-all-cashflow-detail-rows";
import { isPeriodSynced } from "./helpers/is-period-synced";
import { loadActivePaymentMethodIds } from "./helpers/load-active-payment-method-ids";
import { loadFieldMapping } from "./helpers/load-field-mapping";
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
 *
 * Lookup akun tujuan DAN field non-fakta (note/category_id/description)
 * SEKARANG lewat SATU tabel `retailku_sync_field_mapping`, keyed by
 * `total.key` (identitas "jenis" baris, BUKAN `retailkuAccountId`
 * mentah) — lihat docs/todos/plan/retailku-sync-field-mapping.md untuk
 * kenapa `retailku_account_mapping` lama diganti, bukan ditambah tabel
 * terpisah.
 */
export async function computeCashflowSync(
  db: Db,
  input: Pick<SyncCashflowInput, "mcpConfig" | "dateFrom" | "dateTo" | "timezone" | "mode">
): Promise<CashflowSyncPlan> {
  const client = await connectRetailkuMcp(input.mcpConfig);
  try {
    const rows = await fetchAllCashflowDetailRows(client, input);
    const fieldMapping = await loadFieldMapping(db);
    const activePaymentMethodIds = await loadActivePaymentMethodIds(client);

    const totals =
      input.mode === "summary"
        ? aggregateByDateAndAccount(rows)
        : aggregateByDateAccountAndSourceType(rows);

    const planRows: CashflowSyncPlanRow[] = [];
    const unmappedKeys = new Set<string>();
    const deactivatedPaymentMethodAccountIds = new Set<string>();

    for (const total of totals) {
      if (total.net === 0) continue;

      const mapping = fieldMapping.get(total.key) ?? null;
      if (mapping == null) {
        unmappedKeys.add(total.key);
        planRows.push({
          ...total,
          categoryId: null,
          description: null,
          willInsert: false,
          skipReason: "unmapped-account",
          localAccountId: null,
        });
        continue;
      }

      // `note` fallback ke template default (dari fungsi agregasi) kalau
      // user belum atur mapping-nya — fallback PER KOLOM, bukan per
      // baris, lihat "Field fallback default" di dokumen plan.
      const resolved = {
        ...total,
        note: mapping.note ?? total.note,
        categoryId: mapping.categoryId,
        description: mapping.description,
      };

      if (!activePaymentMethodIds.has(total.retailkuAccountId)) {
        deactivatedPaymentMethodAccountIds.add(total.retailkuAccountId);
        planRows.push({
          ...resolved,
          willInsert: false,
          skipReason: "deactivated-payment-method",
          localAccountId: mapping.localAccountId,
        });
        continue;
      }

      const alreadySynced = await isPeriodSynced(db, total.date, total.retailkuAccountId);
      if (alreadySynced) {
        planRows.push({
          ...resolved,
          willInsert: false,
          skipReason: "already-synced",
          localAccountId: mapping.localAccountId,
        });
        continue;
      }

      planRows.push({
        ...resolved,
        willInsert: true,
        skipReason: null,
        localAccountId: mapping.localAccountId,
      });
    }

    return {
      rows: planRows,
      unmappedKeys: [...unmappedKeys],
      deactivatedPaymentMethodAccountIds: [...deactivatedPaymentMethodAccountIds],
    };
  } finally {
    await client.close();
  }
}
