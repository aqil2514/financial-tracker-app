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
  /** `key` (lihat `CashflowSyncPlanRow.key`) yang muncul di data TAPI
   * belum ada baris `retailku_sync_field_mapping` untuknya — di-skip,
   * TIDAK menggagalkan seluruh sync (lihat keputusan #2 revisi di
   * retailku-cashflow-sync.md). BUKAN LAGI `retailkuAccountId` mentah
   * (sebelum retailku_sync_field_mapping menggantikan
   * retailku_account_mapping) — satu akun bisa punya SEBAGIAN key
   * ter-mapping dan sebagian belum (mis. arah inflow sudah diatur,
   * outflow belum), lihat docs/todos/plan/retailku-sync-field-mapping.md. */
  unmappedKeys: string[];
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
  retailkuAccountCode: string;
  accountName: string;
  net: number;
  note: string;
  /** `category_id` hasil lookup `retailku_sync_field_mapping` by `key` —
   * `null` kalau belum di-mapping user (behavior default: transaksi
   * tanpa kategori, SAMA seperti sebelum field mapping ini ada). */
  categoryId: number | null;
  /** Dokumen Tiptap JSON opsional dari mapping, `null` kalau tidak
   * diatur — lihad `description` di `retailku_sync_field_mapping`. */
  description: string | null;
  /** Identitas "jenis" baris ini (TANPA tanggal/nominal) — dipakai
   * lookup ke `retailku_sync_field_mapping`, lihat bentuk key persis di
   * docs/todos/plan/retailku-sync-field-mapping.md. Beda dari
   * `sourceRef` (identitas INSTANCE spesifik, termasuk tanggal, dipakai
   * idempotency). */
  key: string;
  sourceRef: string;
  willInsert: boolean;
  skipReason: "already-synced" | "unmapped-account" | "deactivated-payment-method" | null;
  localAccountId: number | null;
};

export type CashflowSyncPlan = {
  rows: CashflowSyncPlanRow[];
  unmappedKeys: string[];
  /** `retailkuAccountId` yang SUDAH punya mapping tersimpan TAPI
   * `isPaymentMethod`-nya sudah `false` di sisi Retailku saat sync ini
   * berjalan — validasi point-of-use (defense in depth), lihat
   * "Stabilitas retailku_account_id" di retailku-account-mapping.md.
   * Dipisah dari `unmappedKeys` karena akar masalah & pesan yang
   * tepat ke user BEDA: ini bukan "belum dipetakan" (mapping-nya ADA),
   * tapi "akun sudah dinonaktifkan sebagai payment method di Retailku". */
  deactivatedPaymentMethodAccountIds: string[];
};

export type AggregatedTotal = {
  date: string;
  retailkuAccountId: string;
  retailkuAccountCode: string;
  accountName: string;
  net: number;
  note: string;
  /** Lihat `CashflowSyncPlanRow.key`. Digenerate di fungsi agregasi
   * (`aggregate-by-date-and-account.ts`/`aggregate-by-date-account-and-
   * source-type.ts`) — beda mode, beda bentuk key, lihat dokumen plan. */
  key: string;
  sourceRef: string;
};

/** Satu baris `retailku_sync_field_mapping` — field non-fakta yang bisa
 * dikustomisasi user per `key`, lihat
 * docs/todos/plan/retailku-sync-field-mapping.md. `note`/`category_id`/
 * `description` nullable (fallback ke default kalau NULL);
 * `local_account_id` NOT NULL di skema tapi baris BISA TIDAK ADA sama
 * sekali untuk suatu key (berarti key itu belum di-mapping user sama
 * sekali) — dibedakan dari "baris ada tapi field nullable-nya NULL". */
export type RetailkuSyncFieldMappingRow = {
  key: string;
  localAccountId: number;
  note: string | null;
  categoryId: number | null;
  description: string | null;
};
