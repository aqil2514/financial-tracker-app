import type { Env } from "../../shared/env";
import { isAuthorized } from "../../shared/auth";
import { isPushTransactionPayload } from "./schema";
import { insertTransaction } from "./service";

export async function handlePostTransaction(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!isPushTransactionPayload(body)) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const result = await insertTransaction(env, body);

  if (result.status === "rejected") {
    return Response.json({ error: result.reason }, { status: 422 });
  }

  return Response.json({ status: "ok", id: body.id }, { status: 201 });
}
