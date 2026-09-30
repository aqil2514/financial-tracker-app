import type { Env } from "./shared/env";
import { handleGetHealth } from "./modules/health/controller";
import { handlePostTransaction } from "./modules/transactions/controller";
import { handleGetAccountBalance, handlePostCorrectBalance } from "./modules/accounts/controller";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return handleGetHealth(env);
    }

    if (url.pathname === "/transactions" && request.method === "POST") {
      return handlePostTransaction(request, env);
    }

    if (url.pathname === "/accounts/balance" && request.method === "GET") {
      return handleGetAccountBalance(request, env);
    }

    if (url.pathname === "/accounts/correct-balance" && request.method === "POST") {
      return handlePostCorrectBalance(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
