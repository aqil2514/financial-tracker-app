import type { Env } from "../../shared/env";
import { isAuthorized } from "../../shared/auth";
import { isCorrectAccountBalancePayload } from "./schema";
import { correctAccountBalance, getAccountBalance } from "./service";

export async function handleGetAccountBalance(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId");
  if (!accountId) {
    return Response.json({ error: "Missing accountId" }, { status: 400 });
  }

  const balance = await getAccountBalance(env, accountId);
  if (balance === null) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  return Response.json({ accountId, balance });
}

export async function handlePostCorrectBalance(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!isCorrectAccountBalancePayload(body)) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const result = await correctAccountBalance(env, body.accountId, body.targetBalance);

  if (result.status === "account_not_found") {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  if (result.status === "no_change") {
    return Response.json({ status: "ok", message: "Balance already matches target" });
  }

  return Response.json({ status: "ok", transactionId: result.transactionId }, { status: 201 });
}
