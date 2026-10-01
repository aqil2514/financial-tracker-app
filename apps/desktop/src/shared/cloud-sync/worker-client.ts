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
  updatedAt?: string;
};

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
  accountType: "cash" | "debt";
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
      accountType: "cash" | "debt";
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
    }
  >;
};

/** `since` null/undefined -> first sync, Worker balas full snapshot.
 * Lihat apps/worker/docs/todos/plan/cloud-sync.md utk kontrak lengkap. */
export function pullSync(creds: CloudSyncCredentials, since: string | null): Promise<SyncResponse> {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  return request<SyncResponse>(creds, `/sync${query}`);
}
