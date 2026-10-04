import type { AuthInfo } from "@modelcontextprotocol/server";
import { uuidv7 } from "uuidv7";

export type McpToolContext = { http?: { authInfo?: AuthInfo } };

export function getToken(ctx: McpToolContext): string {
  const token = ctx.http?.authInfo?.token;
  if (!token) throw new Error("Missing auth token di konteks tool");
  return token;
}

// Tool tulis selalu kirim id baru (uuidv7) -- pola sama dgn PC desktop &
// Worker, id tidak pernah di-generate server (lihat shared/lww.ts kontrak
// UPSERT). Dipakai semua tool create_*.
export function newId(): string {
  return uuidv7();
}
