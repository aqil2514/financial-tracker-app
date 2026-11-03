import type { CloudSyncCredentials } from "./types";

export class WorkerRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "WorkerRequestError";
  }
}

export type FetchLike = typeof fetch;

export async function workerRequest<T>(
  creds: CloudSyncCredentials,
  path: string,
  init: RequestInit = {},
  fetchImpl: FetchLike = fetch
): Promise<T> {
  const response = await fetchImpl(`${creds.workerUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${creds.token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new WorkerRequestError(response.status, body?.error ?? `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export type PushResult = { status: "ok" } | { status: "ignored" } | { status: "rejected"; reason: string };

// 422 = Worker menolak isi payload (validasi/FK), bukan gangguan jaringan: dikembalikan sebagai hasil, bukan dilempar.
export async function pushUpsert(
  creds: CloudSyncCredentials,
  path: string,
  body: Record<string, unknown>,
  fetchImpl?: FetchLike
): Promise<PushResult> {
  try {
    const result = await workerRequest<{ status: "ok" | "ignored" }>(
      creds,
      path,
      { method: "POST", body: JSON.stringify(body) },
      fetchImpl
    );
    return result.status === "ignored" ? { status: "ignored" } : { status: "ok" };
  } catch (error) {
    if (error instanceof WorkerRequestError && error.status === 422) {
      return { status: "rejected", reason: error.message };
    }
    throw error;
  }
}

// 404 = baris memang sudah tidak ada di cloud, hasil akhirnya sama dengan sukses (idempotent).
export async function pushDelete(
  creds: CloudSyncCredentials,
  path: string,
  body: Record<string, unknown> | null,
  fetchImpl?: FetchLike
): Promise<void> {
  try {
    await workerRequest(
      creds,
      path,
      { method: "DELETE", ...(body && Object.keys(body).length > 0 ? { body: JSON.stringify(body) } : {}) },
      fetchImpl
    );
  } catch (error) {
    if (error instanceof WorkerRequestError && error.status === 404) return;
    throw error;
  }
}
