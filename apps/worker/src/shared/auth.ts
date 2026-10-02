import type { MiddlewareHandler } from "hono";
import type { Env } from "./env";

export function isAuthorized(request: Request, env: Env): boolean {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  // Perbandingan panjang-konstan sederhana -- skala personal single-user,
  // BUKAN sistem multi-tenant kritikal, timing-attack risk diterima sama
  // spt keputusan token plaintext di tabel `settings` PC.
  return token === env.PC_SYNC_TOKEN || token === env.MCP_SYNC_TOKEN;
}

// Middleware Hono -- pasang via `router.use(requireAuth)` di router.ts
// modul yg SEMUA endpoint-nya butuh proteksi, supaya controller TIDAK
// perlu mengulang `if (!isAuthorized(...))` di tiap handler. Kalau
// cuma SEBAGIAN endpoint dalam satu modul yang butuh proteksi, pasang
// per-route: `router.post("/", requireAuth, handler)`.
export const requireAuth: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (!isAuthorized(c.req.raw, c.env)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
};
