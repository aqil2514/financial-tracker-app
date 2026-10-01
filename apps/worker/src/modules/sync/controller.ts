import type { Context } from "hono";
import type { Env } from "../../shared/env";
import { parseSinceParam } from "./schema";
import { getSyncSnapshot } from "./service";

// Autentikasi ditangani requireAuth middleware, dipasang di router.ts.
export async function handleGetSync(c: Context<{ Bindings: Env }>) {
  const sinceParam = c.req.query("since");
  const parsed = parseSinceParam(sinceParam);
  if (!parsed.valid) {
    return c.json({ error: "Invalid 'since' format, expected 'YYYY-MM-DD HH:mm:ss'" }, 400);
  }

  const snapshot = await getSyncSnapshot(c.env, parsed.since);
  return c.json(snapshot, 200);
}
