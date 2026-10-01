import { Hono } from "hono";
import type { Env } from "./shared/env";
import { handleGetHealth } from "./modules/health/controller";
import { transactionsRouter } from "./modules/transactions/router";
import { accountsRouter } from "./modules/accounts/router";
import { accountGroupsRouter } from "./modules/account-groups/router";
import { categoriesRouter } from "./modules/categories/router";
import { contactsRouter } from "./modules/contacts/router";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", handleGetHealth);
app.route("/transactions", transactionsRouter);
app.route("/accounts", accountsRouter);
app.route("/account-groups", accountGroupsRouter);
app.route("/categories", categoriesRouter);
app.route("/contacts", contactsRouter);

export default app;
