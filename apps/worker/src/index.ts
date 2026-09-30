import type { Env } from "./shared/env";
import { handleGetHealth } from "./modules/health/controller";
import { handlePostTransaction } from "./modules/transactions/controller";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return handleGetHealth(env);
    }

    if (url.pathname === "/transactions" && request.method === "POST") {
      return handlePostTransaction(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
