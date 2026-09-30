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

  await insertTransaction(env, body);

  return Response.json({ status: "ok", id: body.id }, { status: 201 });
}
