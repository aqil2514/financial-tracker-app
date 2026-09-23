import type { getDb } from "@/lib/db";
import type { RetailkuMcpConfig } from "@/shared/retailku";
import type { RetailkuCashflowSyncMode } from "../use-retailku-cashflow-sync-settings";

export type Db = Awaited<ReturnType<typeof getDb>>;

export type SyncCashflowInput = {
  mcpConfig: RetailkuMcpConfig;
  /** Tanggal ISO inklusif, lihat "Pertanyaan terbuka #1". */
  dateFrom: string;
  dateTo: string;
  timezone: string;
  mode: RetailkuCashflowSyncMode;
};

export type SyncCashflowResult = {
  /** Berapa baris transaksi baru yang berhasil di-insert (tanggal/baris
   * yang sudah pernah tersinkron sebelumnya di-skip, TIDAK dihitung). */
  insertedCount: number;
  /** `source_ref` dari SEMUA baris yang berhasil di-insert sync ini —
   * dipakai `sync-all.ts` untuk ROLLBACK MANUAL (DELETE) kalau jalur
   * AR/AP gagal setelah cashflow sukses, lihat "Keterkaitan dengan sync
   * utang-piutang" (@tauri-apps/plugin-sql tidak mendukung BEGIN/COMMIT
   * lintas-panggilan dengan aman — connection pool, bukan 1 koneksi). */
  insertedSourceRefs: string[];
  /** `accountId` Retailku yang muncul di data TAPI belum ada baris
   * `retailku_account_mapping` untuknya — di-skip, TIDAK menggagalkan
   * seluruh sync (lihat keputusan #2 revisi). */
  unmappedAccountIds: string[];
  /** `accountId` Retailku yang SUDAH punya mapping TAPI sudah
   * dinonaktifkan sebagai payment method (`isPaymentMethod: false`) —
   * lihat `CashflowSyncPlan.deactivatedPaymentMethodAccountIds`. */
  deactivatedPaymentMethodAccountIds: string[];
};

/** Satu baris cashflow yang AKAN diproses — hasil `computeCashflowSync`,
 * dipakai baik untuk insert sungguhan (`syncCashflow`) maupun preview
 * (baca-saja, lihat use-preview-sync.ts). `willInsert: false` berarti
 * baris ini di-skip (net nol, sudah pernah tersinkron, atau akunnya
 * belum dipetakan) — preview tetap menampilkannya supaya user tahu APA
 * yang di-skip dan KENAPA, bukan cuma total yang akan masuk. */
export type CashflowSyncPlanRow = {
  date: string;
  retailkuAccountId: string;
  accountName: string;
  net: number;
  note: string;
  sourceRef: string;
  willInsert: boolean;
  skipReason: "already-synced" | "unmapped-account" | "deactivated-payment-method" | null;
  localAccountId: number | null;
};

export type CashflowSyncPlan = {
  rows: CashflowSyncPlanRow[];
  unmappedAccountIds: string[];
  /** `retailkuAccountId` yang SUDAH punya mapping tersimpan TAPI
   * `isPaymentMethod`-nya sudah `false` di sisi Retailku saat sync ini
   * berjalan — validasi point-of-use (defense in depth), lihat
   * "Stabilitas retailku_account_id" di retailku-account-mapping.md.
   * Dipisah dari `unmappedAccountIds` karena akar masalah & pesan yang
   * tepat ke user BEDA: ini bukan "belum dipetakan" (mapping-nya ADA),
   * tapi "akun sudah dinonaktifkan sebagai payment method di Retailku". */
  deactivatedPaymentMethodAccountIds: string[];
};

export type AggregatedTotal = {
  date: string;
  retailkuAccountId: string;
  accountName: string;
  net: number;
  note: string;
  sourceRef: string;
};
