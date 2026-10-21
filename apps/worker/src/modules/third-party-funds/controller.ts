import type { Context } from "hono";
import type { AppContext } from "../../shared/auth";
import { isPushThirdPartyFundPayload, isCreateDirectThirdPartyFundPayload } from "./schema";
import { pushThirdPartyFundFromPc, deletePushedThirdPartyFund, createDirectThirdPartyFund } from "./service";

// Autentikasi ditangani requireAuth middleware, dipasang di router.ts.
export async function handlePostThirdPartyFundPush(c: Context<AppContext>) {
  const body = await c.req.json().catch(() => null);
  if (!isPushThirdPartyFundPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await pushThirdPartyFundFromPc(c.env, body, c.get("syncSource"));
  if (result.status === "stale") {
    return c.json({ status: "ignored", id: body.id });
  }
  return c.json({ status: "ok", id: result.id }, 201);
}

export async function handleDeleteThirdPartyFundPush(c: Context<AppContext>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing third party fund id" }, 400);

  const result = await deletePushedThirdPartyFund(c.env, id);
  if (result.status === "not_found") {
    return c.json({ error: "Third party fund not found" }, 404);
  }
  return c.json({ status: "ok", id });
}

// Titip/ambil LANGSUNG dipicu dari MCP -- pola PERSIS handlePostDebt
// (createDirectDebt) / handlePostInvestmentPurchaseDirect, BUKAN jalur
// push. Lihat service.ts (createDirectThirdPartyFund).
export async function handlePostThirdPartyFundDirect(c: Context<AppContext>) {
  const body = await c.req.json().catch(() => null);
  if (!isCreateDirectThirdPartyFundPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await createDirectThirdPartyFund(c.env, body, c.get("syncSource"));
  if (result.status === "stale") {
    return c.json({ status: "ignored", id: body.id });
  }
  if (result.status === "rejected") {
    return c.json({ error: result.reason }, 422);
  }
  return c.json({ status: "ok", id: result.id, transactionId: result.transactionId }, 201);
}
