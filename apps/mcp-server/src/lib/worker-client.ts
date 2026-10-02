// Wrapper HTTP tipis ke apps/worker. Semua tool MCP (baca/tulis)
// manggil Worker lewat sini, BUKAN langsung ke D1 -- validasi bisnis
// harus tetap satu pintu di Worker.

function workerUrl(): string {
  const url = process.env.WORKER_URL;
  if (!url) throw new Error("WORKER_URL env var belum di-set");
  return url.replace(/\/$/, "");
}

export class WorkerRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "WorkerRequestError";
  }
}

export async function workerFetch<TResponse>(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<TResponse> {
  const response = await fetch(`${workerUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
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

// Dipakai di flow OAuth (/oauth/authorize) utk cek token yg dimasukkan
// user valid sebelum code exchange terjadi, TANPA sentuh D1 di sisi
// Worker. TIDAK throw -- return boolean murni.
export async function verifyWorkerToken(token: string): Promise<boolean> {
  try {
    await workerFetch(token, "/auth/verify");
    return true;
  } catch {
    return false;
  }
}
