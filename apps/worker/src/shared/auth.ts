import type { Env } from "./env";

export function isAuthorized(request: Request, env: Env): boolean {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  // Perbandingan panjang-konstan sederhana -- skala personal single-user,
  // BUKAN sistem multi-tenant kritikal, timing-attack risk diterima sama
  // spt keputusan token plaintext di tabel `settings` PC.
  return token === env.PC_SYNC_TOKEN;
}
