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

// Varian `workerFetch` utk body `multipart/form-data` (upload binary) --
// BEDA dari `workerFetch` yg SELALU paksa Content-Type: application/json
// kalau ada body. Dipakai tool MCP `upload_attachment` (POST /attachments,
// lihat apps/worker/src/modules/attachments/schema.ts). JANGAN set
// Content-Type manual di sini -- `fetch` auto-generate header
// `multipart/form-data; boundary=...` yg benar saat body instanceof
// FormData, override manual akan merusak boundary.
export async function workerFetchForm<TResponse>(token: string, path: string, form: FormData): Promise<TResponse> {
  const response = await fetch(`${workerUrl()}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = (body as { error?: string } | null)?.error ?? `HTTP ${response.status}`;
    throw new WorkerRequestError(response.status, message);
  }

  return response.json() as Promise<TResponse>;
}

// Baca isi file binary dari Worker (GET /attachments/:id balas raw bytes,
// BUKAN JSON -- lihat apps/worker/src/modules/attachments/controller.ts
// handleGetAttachment). `workerFetch` tidak cocok krn selalu `.json()`
// response. Dipakai tool MCP `get_attachment` utk dapat base64+mimeType
// yg dibungkus jadi ImageContent block.
export async function workerFetchBinary(
  token: string,
  path: string
): Promise<{ bytes: ArrayBuffer; contentType: string | null }> {
  const response = await fetch(`${workerUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = (body as { error?: string } | null)?.error ?? `HTTP ${response.status}`;
    throw new WorkerRequestError(response.status, message);
  }

  return { bytes: await response.arrayBuffer(), contentType: response.headers.get("Content-Type") };
}
