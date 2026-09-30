import type { Env } from "../../shared/env";

export async function handleGetHealth(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table'"
  ).all<{ name: string }>();
  return Response.json({ status: "ok", tables: results.map((row) => row.name) });
}
