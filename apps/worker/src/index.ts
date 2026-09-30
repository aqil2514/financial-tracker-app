import { Hono } from "hono";
import type { Env } from "./shared/env";
import { handleGetHealth } from "./modules/health/controller";
import { transactionsRouter } from "./modules/transactions/router";
import { accountsRouter } from "./modules/accounts/router";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", handleGetHealth);
app.route("/transactions", transactionsRouter);
app.route("/accounts", accountsRouter);

export default app;
