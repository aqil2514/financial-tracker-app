import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./shared/env";
import { requireAuth } from "./shared/auth";
import { handleGetHealth } from "./modules/health/controller";
import { transactionsRouter } from "./modules/transactions/router";
import { accountsRouter } from "./modules/accounts/router";
import { accountGroupsRouter } from "./modules/account-groups/router";
import { categoriesRouter } from "./modules/categories/router";
import { contactsRouter } from "./modules/contacts/router";
import { syncRouter } from "./modules/sync/router";

const app = new Hono<{ Bindings: Env }>();

// Izinkan semua origin -- klien (apps/desktop Tauri WebView) origin-nya
// bisa beda2 (localhost:3000 saat dev, custom scheme saat production
// build). Aman krn SETIAP endpoint tulis/baca tetap wajib Bearer token
// (PC_SYNC_TOKEN) -- CORS di sini cuma relevan utk browser biasa, bukan
// garis pertahanan utama.
app.use("*", cors());

app.get("/health", handleGetHealth);
// Endpoint ringan khusus validasi token (PC_SYNC_TOKEN ATAU
// MCP_SYNC_TOKEN), tanpa sentuh D1 -- dipakai apps/mcp-server saat
// proses OAuth authorize utk cek token yg dimasukkan user valid,
// sebelum code exchange terjadi.
app.get("/auth/verify", requireAuth, (c) => c.json({ ok: true }));
app.route("/transactions", transactionsRouter);
app.route("/accounts", accountsRouter);
app.route("/account-groups", accountGroupsRouter);
app.route("/categories", categoriesRouter);
app.route("/contacts", contactsRouter);
app.route("/sync", syncRouter);

export default app;
