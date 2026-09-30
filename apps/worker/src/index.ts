export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      const { results } = await env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table'"
      ).all<{ name: string }>();
      return Response.json({ status: "ok", tables: results.map((row) => row.name) });
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
