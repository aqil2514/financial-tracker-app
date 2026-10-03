import type { MiddlewareHandler } from "hono";
import type { Env } from "./env";

export type SyncSource = "pc" | "mcp";

// Dipakai semua router/controller yg butuh tau token mana yg dipakai
// request (lewat requireAuth) -- lihat resolveSyncSource di bawah.
export type AppContext = { Bindings: Env; Variables: { syncSource: SyncSource } };

export function isAuthorized(request: Request, env: Env): boolean {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  // Perbandingan panjang-konstan sederhana -- skala personal single-user,
  // BUKAN sistem multi-tenant kritikal, timing-attack risk diterima sama
  // spt keputusan token plaintext di tabel `settings` PC.
  return token === env.PC_SYNC_TOKEN || token === env.MCP_SYNC_TOKEN;
}

// Derive identitas pemanggil dari token yg dipakai -- SATU-SATUNYA sumber
// kebenaran utk `sync_source` dinamis (lihat shared/lww.ts pattern serupa
// utk LWW). TIDAK PERNAH percaya `sync_source` dari body payload client,
// krn itu bisa dipalsukan -- nilai ini HARUS derive dari token di sini.
export function resolveSyncSource(request: Request, env: Env): SyncSource | null {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length);
  if (token === env.PC_SYNC_TOKEN) return "pc";
  if (token === env.MCP_SYNC_TOKEN) return "mcp";
  return null;
}

// Middleware Hono -- pasang via `router.use(requireAuth)` di router.ts
// modul yg SEMUA endpoint-nya butuh proteksi, supaya controller TIDAK
// perlu mengulang `if (!isAuthorized(...))` di tiap handler. Kalau
// cuma SEBAGIAN endpoint dalam satu modul yang butuh proteksi, pasang
// per-route: `router.post("/", requireAuth, handler)`.
export const requireAuth: MiddlewareHandler<AppContext> = async (c, next) => {
  const syncSource = resolveSyncSource(c.req.raw, c.env);
  if (!syncSource) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("syncSource", syncSource);
  await next();
};
