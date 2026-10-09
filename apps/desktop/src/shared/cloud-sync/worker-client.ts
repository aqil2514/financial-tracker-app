/**
 * Client fetch utk apps/worker (Cloudflare) -- fondasi Tahap 6, lihat
 * docs/todos/plan/mcp-server-cloud-mirror.md. Murni wrapper HTTP tipis:
 * tidak tahu kapan dipanggil (itu urusan hook push on-write / logic
 * pull terpisah, BELUM dibuat), cuma tahu BAGAIMANA memanggil endpoint
 * Worker dgn benar (payload camelCase, auth header, error handling).
 *
 * Semua fungsi terima `{ workerUrl, token }` eksplisit (BUKAN baca
 * dari useCloudSyncSettings sendiri) -- modul ini tetap murni/testable
 * tanpa bergantung ke React Query/SQLite, caller yg bertanggung jawab
 * resolve kredensial dulu.
 */

import type { AccountType } from "@/lib/account-types";

export type CloudSyncCredentials = {
  workerUrl: string;
  token: string;
};

export class WorkerRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "WorkerRequestError";
  }
}

async function request<TResponse>(
  creds: CloudSyncCredentials,
  path: string,
  init: RequestInit = {}
): Promise<TResponse> {
  const url = `${creds.workerUrl.replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${creds.token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = (body as { error?: string } | null)?.error ?? `HTTP ${response.status}`;
    throw new WorkerRequestError(response.status, message);
  }

  return response.json() as Promise<TResponse>;
}

/** Dipakai tombol "Tes Koneksi" -- panggil /health (TANPA auth di sisi
 * Worker, tapi di sini tetap kirim token biar sekalian ketahuan kalau
 * token salah dari endpoint lain nanti). Return true/false, TIDAK
 * throw, supaya UI caller bisa render pesan generik "berhasil"/"gagal"
 * tanpa try/catch berlapis. */
export async function testCloudSyncConnection(creds: CloudSyncCredentials): Promise<boolean> {
  try {
    await request(creds, "/health");
    return true;
  } catch {
    return false;
  }
}

// --- Push: UPSERT 1 baris per panggilan, LWW via `updatedAt` ---
// Bentuk payload SAMA PERSIS dgn kontrak Worker (lihat
// apps/worker/src/modules/*/schema.ts) -- field camelCase, `updatedAt`
// opsional format "YYYY-MM-DD HH:mm:ss" (lihat shared/lww.ts Worker).

export type PushUpsertResult = { status: "ok" } | { status: "ignored" } | { status: "rejected"; reason: string };

async function pushUpsert(
  creds: CloudSyncCredentials,
  path: string,
  payload: Record<string, unknown>
): Promise<PushUpsertResult> {
  try {
    const result = await request<{ status: "ok" | "ignored" }>(creds, path, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (result.status === "ignored") return { status: "ignored" };
    return { status: "ok" };
  } catch (err) {
    if (err instanceof WorkerRequestError && err.status === 422) {
      return { status: "rejected", reason: err.message };
    }
    throw err;
  }
}

export type PushTransactionPayload = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  note: string;
  date: string;
  categoryId?: string | null;
  accountId?: string | null;
  transferAccountId?: string | null;
  description?: string | null;
  contactId?: string | null;
  debtAction?: "settlement" | "payable" | null;
  settleDebtIds?: string[];
  // Provenance baris (kolom `source`/`source_ref`) -- WAJIB ikut supaya
  // baris hasil sync Retailku tidak jatuh jadi 'manual' di D1.
  source?: TransactionSource;
  sourceRef?: string | null;
  updatedAt?: string;
};

export type TransactionSource = "manual" | "retailku_sync";

export function pushTransaction(creds: CloudSyncCredentials, payload: PushTransactionPayload) {
  return pushUpsert(creds, "/transactions", payload);
}

export type PushAccountPayload = {
  id: string;
  name: string;
  initialBalance: number;
  groupId?: string | null;
  description?: string | null;
  isActive?: boolean;
  accountType: AccountType;
  icon?: string | null;
  color?: string | null;
  updatedAt?: string;
};

export function pushAccount(creds: CloudSyncCredentials, payload: PushAccountPayload) {
  return pushUpsert(creds, "/accounts", payload);
}

export type PushAccountGroupPayload = { id: string; name: string; updatedAt?: string };

export function pushAccountGroup(creds: CloudSyncCredentials, payload: PushAccountGroupPayload) {
  return pushUpsert(creds, "/account-groups", payload);
}

export type PushCategoryPayload = {
  id: string;
  name: string;
  type: "income" | "expense";
  icon?: string | null;
  parentId?: string | null;
  isActive?: boolean;
  updatedAt?: string;
};

export function pushCategory(creds: CloudSyncCredentials, payload: PushCategoryPayload) {
  return pushUpsert(creds, "/categories", payload);
}

export type PushContactPayload = { id: string; name: string; note?: string | null; updatedAt?: string };

export function pushContact(creds: CloudSyncCredentials, payload: PushContactPayload) {
  return pushUpsert(creds, "/contacts", payload);
}

// Push baris debts/debt_payments yg PC SUDAH buat sendiri lewat
// apply-debt-transaction.ts lokal (source-based ownership, lihat
// docs/todos/plan/fix-debts-duplikasi-sync.md) -- upsert-by-id MURNI,
// endpoint TERPISAH dari createDirectDebt/createNonCashPayment (yg
// servernya sendiri bikin transaksi closing baru, salah utk kasus ini
// krn transactionId SUDAH ada).
export type PushDebtPayload = {
  id: string;
  type: "receivable" | "payable";
  contactId?: string | null;
  amount: number;
  accountId?: string | null;
  transactionId: string;
  status?: "ongoing" | "paid" | "written_off";
  note?: string | null;
  date: string;
  source?: TransactionSource;
  sourceRef?: string | null;
  updatedAt?: string;
};

export function pushDebt(creds: CloudSyncCredentials, payload: PushDebtPayload) {
  return pushUpsert(creds, "/debts/push", payload);
}

export type PushDebtPaymentPayload = {
  id: string;
  debtId: string;
  amount: number;
  accountId?: string | null;
  transactionId?: string | null;
  note?: string | null;
  date: string;
  source?: TransactionSource;
  sourceRef?: string | null;
  updatedAt?: string;
};

export function pushDebtPayment(creds: CloudSyncCredentials, payload: PushDebtPaymentPayload) {
  return pushUpsert(creds, "/debts/payments/push", payload);
}

// Push baris investment_accounts/investment_purchases/investment_sales
// yg PC SUDAH buat sendiri lewat apply-investment-transaction.ts/
// apply-sell-investment-transaction.ts lokal -- upsert-by-id MURNI, pola
// PERSIS pushDebt/pushDebtPayment (lihat
// apps/worker/src/modules/investments/schema.ts).
export type PushInvestmentAccountPayload = {
  accountId: string;
  unitLabel: string;
  currentMarketValue: number;
  updatedAt?: string;
};

export function pushInvestmentAccount(creds: CloudSyncCredentials, payload: PushInvestmentAccountPayload) {
  return pushUpsert(creds, "/investments/accounts/push", payload);
}

export type PushInvestmentPurchasePayload = {
  id: string;
  accountId: string;
  transactionId: string;
  unit: number | null;
  pricePerUnit: number | null;
  date: string;
  status?: "pending" | "settled";
  updatedAt?: string;
};

export function pushInvestmentPurchase(creds: CloudSyncCredentials, payload: PushInvestmentPurchasePayload) {
  return pushUpsert(creds, "/investments/purchases/push", payload);
}

export type PushInvestmentSalePayload = {
  id: string;
  accountId: string;
  transactionId: string | null;
  adjustmentTransactionId: string | null;
  unit: number;
  pricePerUnit: number;
  averageCostPerUnit: number | null;
  realizedPl: number | null;
  date: string;
  status?: "pending" | "settled";
  updatedAt?: string;
};

export function pushInvestmentSale(creds: CloudSyncCredentials, payload: PushInvestmentSalePayload) {
  return pushUpsert(creds, "/investments/sales/push", payload);
}

// --- Labels: dictionary + attach/detach, lihat
// apps/worker/src/modules/labels/* dan docs/todos/plan/general-label.md.
// BEDA dari pushUpsert generik di atas -- attach/detach butuh `entityId`
// di PATH (bukan cuma body), jadi fungsi sendiri bukan reuse pushUpsert.

export type PushLabelPayload = {
  id: string;
  name: string;
  scope: "transaction_category" | "account";
  updatedAt?: string;
};

export function pushLabel(creds: CloudSyncCredentials, payload: PushLabelPayload) {
  return pushUpsert(creds, "/labels", payload);
}

export type LabelEntityScope = "transactions" | "categories" | "accounts";

export type PushAttachLabelPayload = {
  id: string;
  labelId: string;
  updatedAt?: string;
};

export function pushAttachLabel(
  creds: CloudSyncCredentials,
  scope: LabelEntityScope,
  entityId: string,
  payload: PushAttachLabelPayload
) {
  return pushUpsert(creds, `/labels/${scope}/${encodeURIComponent(entityId)}`, payload);
}

/** Detach TIDAK py bentuk LWW upsert (tidak ada `updatedAt` yg dikirim) --
 * endpoint Worker DELETE /labels/:scope/:entityId/:labelId langsung
 * soft-delete baris junction tanpa pembanding timestamp, pola sama
 * deleteCloudRow generik tapi path-nya 3 segment (bukan 1 `:id`). */
export async function detachLabelCloud(
  creds: CloudSyncCredentials,
  scope: LabelEntityScope,
  entityId: string,
  labelId: string
): Promise<void> {
  await request(
    creds,
    `/labels/${scope}/${encodeURIComponent(entityId)}/${encodeURIComponent(labelId)}`,
    { method: "DELETE" }
  );
}

// --- Attachments: upload/download binary via R2, lihat
// apps/worker/docs/todos/plan/attachment-r2-sync.md + modules/attachments/*
// (Worker). BEDA dari pushUpsert generik di atas -- body `multipart/
// form-data` (file binary + field), bukan JSON, jadi TIDAK reuse
// `request()` yang hardcode Content-Type: application/json.

export type PushAttachmentPayload = {
  id: string;
  transactionId: string;
  bytes: Uint8Array;
  contentType: string | null;
  updatedAt?: string;
};

export async function pushAttachment(
  creds: CloudSyncCredentials,
  payload: PushAttachmentPayload
): Promise<PushUpsertResult> {
  const form = new FormData();
  form.set("id", payload.id);
  form.set("transactionId", payload.transactionId);
  if (payload.updatedAt) form.set("updatedAt", payload.updatedAt);
  // `Blob` butuh backing ArrayBuffer murni (bukan ArrayBufferLike) --
  // `.slice()` normalisasi copy yang tipenya pasti ArrayBuffer.
  const arrayBuffer = payload.bytes.buffer.slice(
    payload.bytes.byteOffset,
    payload.bytes.byteOffset + payload.bytes.byteLength
  ) as ArrayBuffer;
  form.set("file", new Blob([arrayBuffer], { type: payload.contentType ?? undefined }));

  const url = `${creds.workerUrl.replace(/\/$/, "")}/attachments`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.token}` },
    body: form,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = (body as { error?: string } | null)?.error ?? `HTTP ${response.status}`;
    if (response.status === 422) return { status: "rejected", reason: message };
    throw new WorkerRequestError(response.status, message);
  }
  const result = (await response.json()) as { status: "ok" | "ignored" };
  return result.status === "ignored" ? { status: "ignored" } : { status: "ok" };
}

export type AttachmentListItem = {
  id: string;
  transactionId: string;
  contentType: string | null;
  sizeBytes: number | null;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type AttachmentListResponse = { checkpoint: string; attachments: AttachmentListItem[] };

/** `since` null -> first sync, Worker balas semua baris (termasuk yang
 * `deletedAt` terisi). Cuma metadata -- bytes diambil terpisah per baris
 * via `getAttachmentBytes`, lihat pull-attachments.ts. `checkpoint`
 * dipakai caller sbg `?since=` pull berikutnya (simpan via
 * `useSetAttachmentsCheckpoint`), SAMA pola dgn `pullSync`. */
export function listAttachmentsSince(
  creds: CloudSyncCredentials,
  since: string | null
): Promise<AttachmentListResponse> {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  return request(creds, `/attachments${query}`);
}

/** Download isi file dari R2 (lewat Worker) -- dipakai pull utk
 * menyimpan ke disk lokal via `save_attachment_bytes` (Rust). */
export async function getAttachmentBytes(
  creds: CloudSyncCredentials,
  id: string
): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const url = `${creds.workerUrl.replace(/\/$/, "")}/attachments/${encodeURIComponent(id)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${creds.token}` } });
  if (!response.ok) {
    throw new WorkerRequestError(response.status, `HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return { bytes: new Uint8Array(buffer), contentType: response.headers.get("Content-Type") };
}

// --- Pull: GET /sync?since= ---
// Bentuk response SAMA PERSIS dgn apps/worker/src/modules/sync/service.ts
// (SyncResponse) -- camelCase, termasuk baris `deletedAt` terisi.

export type SyncRow = { id: string; updatedAt: string | null; deletedAt: string | null };

export type SyncResponse = {
  checkpoint: string;
  accountGroups: Array<SyncRow & { name: string }>;
  categories: Array<
    SyncRow & {
      name: string;
      icon: string | null;
      type: "income" | "expense";
      parentId: string | null;
      isActive: boolean;
    }
  >;
  contacts: Array<SyncRow & { name: string; note: string | null }>;
  accounts: Array<
    SyncRow & {
      name: string;
      icon: string | null;
      initialBalance: number;
      groupId: string | null;
      description: string | null;
      isActive: boolean;
      accountType: AccountType;
      color: string | null;
    }
  >;
  transactions: Array<
    SyncRow & {
      type: "income" | "expense" | "transfer";
      amount: number;
      categoryId: string | null;
      accountId: string | null;
      transferAccountId: string | null;
      note: string;
      date: string;
      description: string | null;
      contactId: string | null;
      source: TransactionSource;
      sourceRef: string | null;
    }
  >;
  debts: Array<
    SyncRow & {
      type: "receivable" | "payable";
      contactId: string | null;
      amount: number;
      accountId: string | null;
      transactionId: string | null;
      status: "ongoing" | "paid" | "written_off";
      note: string | null;
      date: string;
      source: TransactionSource;
      sourceRef: string | null;
    }
  >;
  debtPayments: Array<
    SyncRow & {
      debtId: string;
      amount: number;
      accountId: string | null;
      transactionId: string | null;
      note: string | null;
      date: string;
      source: TransactionSource;
      sourceRef: string | null;
    }
  >;
};

/** `since` null/undefined -> first sync, Worker balas full snapshot.
 * Lihat apps/worker/docs/todos/plan/cloud-sync.md utk kontrak lengkap. */
export function pullSync(creds: CloudSyncCredentials, since: string | null): Promise<SyncResponse> {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  return request<SyncResponse>(creds, `/sync${query}`);
}

// --- Delete: soft-delete 1 baris di Worker (DELETE /:path/:id) ---
// Payload action EKSPLISIT per relasi, PERSIS pola desktop lokal (lihat
// use-delete-account-group.ts/use-delete-account.ts/use-delete-category.ts) --
// `contacts` TANPA payload sama sekali (desktop tidak py reassign/
// unassign di sana). `transactions` JUGA tanpa payload (beda dari 3
// tabel awal: tindakan thd debt/debt_payments terkait TUNGGAL per role,
// TIDAK ada pilihan dari client -- lihat deleteTransactionCloud di
// bawah utk fungsi terpisah krn py bentuk response beda, bukan void).

export type DeleteCloudPayload =
  | { table: "account_groups"; memberAction?: "unassign" | "reassign"; targetGroupId?: string }
  | { table: "accounts"; transactionAction?: "unassign" | "reassign"; targetAccountId?: string }
  | {
      table: "categories";
      childAction?: "unassign" | "reassign";
      targetParentId?: string;
      transactionAction?: "unassign" | "reassign";
      targetCategoryId?: string;
    }
  | { table: "contacts" }
  | { table: "transactions" }
  // Soft-delete baris debts/debt_payments yg PC hapus lokal sbg bagian
  // dari RECREATE (applyDebtTransactionEdit: field berbahaya berubah ->
  // hapus lama, insert baru dgn id BARU) -- TANPA payload (beda skenario
  // dari delete transaksi, lihat deletePushedDebt di Worker service.ts).
  | { table: "debts" }
  | { table: "debt_payments" }
  // Sejajar debts/debt_payments di atas -- soft-delete baris
  // investment_purchases/investment_sales yg PC hapus lokal sbg bagian
  // dari RECREATE (applyInvestmentTransactionEdit/
  // applySellInvestmentTransactionEdit lokal). investment_accounts TIDAK
  // perlu entry di sini -- baris itu TIDAK PERNAH direcreate (1:1 dgn
  // accounts, dihapus hanya lewat DELETE /accounts yg Worker tangani via
  // CASCADE di D1, bukan jalur push desktop).
  | { table: "investment_purchases" }
  | { table: "investment_sales" }
  // Hard-delete object R2 + soft-delete row D1 sekaligus di sisi Worker
  // (lihat apps/worker/src/modules/attachments/service.ts deleteAttachment)
  // -- TANPA payload action sama sekali, sama bentuknya dgn contacts/
  // transactions di atas.
  | { table: "transaction_attachments" };

const DELETE_PATH: Record<DeleteCloudPayload["table"], string> = {
  account_groups: "/account-groups",
  accounts: "/accounts",
  categories: "/categories",
  contacts: "/contacts",
  investment_purchases: "/investments/purchases/push",
  investment_sales: "/investments/sales/push",
  transactions: "/transactions",
  debts: "/debts/push",
  debt_payments: "/debts/payments/push",
  transaction_attachments: "/attachments",
};

export async function deleteCloudRow(
  creds: CloudSyncCredentials,
  table: DeleteCloudPayload["table"],
  id: string,
  payload?: Omit<Extract<DeleteCloudPayload, { table: typeof table }>, "table">
): Promise<void> {
  const body = payload && Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined;
  await request(creds, `${DELETE_PATH[table]}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    ...(body ? { body } : {}),
  });
}

// `debtInfo` SAMA PERSIS bentuknya dgn DeletedTransactionDebtInfo di
// apps/worker/src/modules/debts/service.ts -- dipakai dialog PC utk
// pesan informatif SETELAH delete berhasil (bukan "cek dulu baru
// hapus" 2 round-trip, keputusan 2026-10-03 lihat cloud-sync.md).
export type TransactionDebtInfo =
  | { role: "none" }
  | { role: "payment"; debtId: string }
  | { role: "principal"; debtId: string; hadPayments: boolean };

// Terpisah dari deleteCloudRow krn py bentuk response beda (bukan
// void) -- endpoint Worker /transactions/:id balas {status, id,
// debtInfo}, PC butuh debtInfo itu utk toast informatif.
export async function deleteTransactionCloud(
  creds: CloudSyncCredentials,
  id: string
): Promise<TransactionDebtInfo> {
  const result = await request<{ debtInfo: TransactionDebtInfo }>(
    creds,
    `/transactions/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
  return result.debtInfo;
}
