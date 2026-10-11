import type { Context } from "hono";
import type { AppContext } from "../../shared/auth";
import { isCategoryPeriodPayload } from "./schema";
import { upsertCategoryPeriod, deleteCategoryPeriod, getCategoryPeriodSummary } from "./service";

export async function handlePostCategoryPeriodPush(c: Context<AppContext>) {
  const body = await c.req.json().catch(() => null);
  if (!isCategoryPeriodPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await upsertCategoryPeriod(c.env, body, c.get("syncSource"));
  if (result.status === "stale") {
    return c.json({ status: "ignored", id: body.id });
  }
  return c.json({ status: "ok", id: result.id }, 201);
}

export async function handleDeleteCategoryPeriodPush(c: Context<AppContext>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing category period id" }, 400);

  const result = await deleteCategoryPeriod(c.env, id);
  if (result.status === "not_found") {
    return c.json({ error: "Category period not found" }, 404);
  }
  return c.json({ status: "ok", id }, 200);
}

export async function handleGetCategoryPeriodSummary(c: Context<AppContext>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing category period id" }, 400);

  const summary = await getCategoryPeriodSummary(c.env, id);
  if (!summary) {
    return c.json({ error: "Category period not found" }, 404);
  }
  return c.json(summary);
}
