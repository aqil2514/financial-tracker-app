import type { Context } from "hono";
import type { AppContext } from "../../shared/auth";

export async function handleGetHealth(c: Context<AppContext>) {
  const { results } = await c.env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table'"
  ).all<{ name: string }>();
  return c.json({ status: "ok", tables: results.map((row) => row.name) });
}
