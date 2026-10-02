// State sementara proses OAuth shim -- in-memory, BUKAN database.
// Keputusan sadar (2026-10-03): resiko gagal saat code/client disimpan
// di satu instance serverless lalu ditukar di instance lain diterima,
// krn flow ini cuma terjadi sekali per setup koneksi client MCP (bukan
// dipakai tiap request harian) -- user tinggal ulang authorize kalau
// kena. Upgrade ke KV (Cloudflare lewat Worker, atau Vercel) kalau
// nanti ternyata sering gagal di praktik.

type AuthCodeEntry = {
  token: string;
  codeChallenge: string;
  expiresAt: number;
};

type RegisteredClient = {
  redirectUris: string[];
};

const authCodes = new Map<string, AuthCodeEntry>();
const registeredClients = new Map<string, RegisteredClient>();

const CODE_TTL_MS = 5 * 60 * 1000;

export function registerClient(redirectUris: string[]): string {
  const clientId = crypto.randomUUID();
  registeredClients.set(clientId, { redirectUris });
  return clientId;
}

export function issueAuthCode(token: string, codeChallenge: string): string {
  const code = crypto.randomUUID();
  authCodes.set(code, { token, codeChallenge, expiresAt: Date.now() + CODE_TTL_MS });
  return code;
}

export function consumeAuthCode(code: string): AuthCodeEntry | undefined {
  const entry = authCodes.get(code);
  authCodes.delete(code);
  if (!entry || Date.now() > entry.expiresAt) return undefined;
  return entry;
}
