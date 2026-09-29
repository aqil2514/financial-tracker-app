import type { getDb } from "@/lib/db";
import type { FieldMappingExtraFields, RetailkuMcpConfig } from "@/shared/retailku";
import type { ResolvedDownPayment } from "./helpers/ar-ap-plan-rows/resolve-down-payment";
import type { RetailkuArApExistingMode, RetailkuCashflowSyncMode } from "../use-retailku-cashflow-sync-settings";

export type Db = Awaited<ReturnType<typeof getDb>>;

export type SyncCashflowInput = {
  mcpConfig: RetailkuMcpConfig;
  dateFrom: string;
  dateTo: string;
  timezone: string;
  mode: RetailkuCashflowSyncMode;
  arApExistingMode: RetailkuArApExistingMode;
};

export type SyncCashflowResult = {
  insertedCount: number;
  insertedSourceRefs: string[];
  unmappedKeys: string[];
  deactivatedPaymentMethodAccountIds: string[];
  arApInsertedCount: number;
  arApInsertedSourceRefs: string[];
  arApUpdatedCount: number;
  arApPaymentInsertedCount: number;
  arApPaymentInsertedSourceRefs: string[];
  arApDownPaymentInsertedCount: number;
  arApDownPaymentInsertedSourceRefs: string[];
  arApUnmappedDebtKeys: string[];
};

export type CashflowSyncPlanRow = {
  date: string;
  retailkuAccountId: string;
  retailkuAccountCode: string;
  accountName: string;
  net: number;
  note: string;
  categoryId: string | null;
  description: string | null;
  key: string;
  sourceRef: string;
  willInsert: boolean;
  skipReason: "already-synced" | "unmapped-account" | "deactivated-payment-method" | null;
  localAccountId: string | null;
};

export type CashflowSyncPlan = {
  rows: CashflowSyncPlanRow[];
  unmappedKeys: string[];
  deactivatedPaymentMethodAccountIds: string[];
  arAp: ArApSyncPlan;
};

export type ArApSkipReason =
  | "already-synced"
  | "unmapped-debt-account"
  | "zero-amount"
  | "reversal"
  | "settlement-not-supported"
  | "settled-debt-not-found"
  | "settlement-partially-not-found";

export type ArApSyncPlanRow = {
  journalItemId: string;
  date: string;
  accountId: string;
  accountName: string;
  direction: "receivable" | "payable";
  kind: "trade" | "non-trade" | null;
  partyName: string | null;
  amount: number;
  sourceRef: string;
  key: string;
  willInsert: boolean;
  /** true = baris ini sudah pernah sync SEBELUMNYA dan mode "overwrite"
   * aktif — insertArApTransaction akan UPDATE debts.id ini, bukan
   * INSERT baru. existingDebtId wajib terisi kalau ini true. */
  willUpdate: boolean;
  existingDebtId: string | null;
  /** true = baris ini pelunasan piutang dagang (SALE_PAYMENT) yang
   * piutang aslinya SUDAH pernah tersinkron — akan di-INSERT sebagai
   * `debt_payments` baru (BUKAN insert/update `debts`), mengurangi
   * sisa piutang di `paymentDebtId` tanpa mengubah `debts.amount`
   * (pokok tetap, cicilan terpisah — lihat 0012_debts.sql). Baru
   * mencakup SALE_PAYMENT (piutang dagang) — PURCHASE_PAYMENT/
   * LEDGER_ENTRY_PAYMENT/CONSIGNMENT_SETTLEMENT masih
   * `settlement-not-supported`. */
  willInsertPayment: boolean;
  /** `debts.id` yang dicicil — wajib terisi kalau willInsertPayment
   * true, hasil lookup `source_ref` = piutang asli via
   * `settledReceivablePayableJournalItemId`. */
  paymentDebtId: string | null;
  /** Alokasi pelunasan CONSIGNMENT_SETTLEMENT — satu baris melunasi
   * BANYAK `debts` sekaligus (beda dari willInsertPayment/paymentDebtId
   * yang cuma untuk 1 debt). `[]` kalau bukan kasus ini. Kebijakan
   * all-or-nothing: kalau SATU SAJA debtId di
   * `settledReceivablePayableJournalItemIds` tidak ketemu di debts
   * lokal, array ini TETAP `[]` dan skipReason jadi
   * "settlement-partially-not-found" — TIDAK proses partial. */
  willInsertPayments: { debtId: string; amount: number }[];
  /** Akun kas lokal yang menerima pelunasan ini — hasil resolve
   * row.cashAccounts via resolveArApCashAccounts. Cuma terisi kalau
   * baris pelunasan (willInsertPayment atau willInsertPayments) PERSIS
   * punya 1 cashAccount di sisi Retailku DAN sudah dipetakan ke akun
   * lokal (localAccountId != null) — data nyata Warung Aqil (26 baris
   * pelunasan tersedia, semua sourceType) selalu tepat 1 akun kas per
   * pelunasan, split ke >1 akun kas belum pernah terjadi. NULL untuk
   * kasus lain (0 atau >1 cashAccount, atau belum dipetakan) — akun
   * kas tetap tidak terisi, tapi pelunasan itu sendiri tetap tercatat. */
  paymentAccountId: string | null;
  /** DP/uang muka yang diterima BERSAMAAN piutang/utang baru tercipta
   * (row.willInsert atau row.willUpdate true, row.amount SUDAH net
   * setelah DP dikurangi) — hasil resolve row.cashAccounts via
   * resolveDownPayment. `null` kalau tidak ada DP (cashAccounts kosong)
   * ATAU polanya bukan DP murni (>1 cashAccount, amount negatif/campuran
   * — kasus talangan/PPOB, sengaja diabaikan) ATAU akun kasnya belum
   * dipetakan. Diinsert sebagai baris `transactions` BIASA (BUKAN
   * debt_payments) — debts.amount TETAP row.amount, tidak disentuh. */
  downPayment: ResolvedDownPayment | null;
  skipReason: ArApSkipReason | null;
  debtLocalAccountId: string | null;
  contactId: string | null;
  contactFollowSource: boolean;
};

export type ArApSyncPlan = {
  rows: ArApSyncPlanRow[];
  unmappedDebtKeys: string[];
};

export type AggregatedTotal = {
  date: string;
  retailkuAccountId: string;
  retailkuAccountCode: string;
  accountName: string;
  net: number;
  note: string;
  key: string;
  sourceRef: string;
};

export type RetailkuSyncFieldMappingRow = {
  key: string;
  localAccountId: string;
  note: string | null;
  categoryId: string | null;
  description: string | null;
  extraFields: FieldMappingExtraFields;
};
