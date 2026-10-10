import type { CloudSyncCredentials } from "./types";
import { WorkerRequestError } from "./worker-request-error";

export async function request<TResponse>(
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
