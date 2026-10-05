import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";

export const maxDuration = 30;
import { verifyWorkerToken } from "@/lib/worker-client";
import { registerAllMcpTools } from "@/lib/mcp-tools";

const handler = createMcpHandler(
  (server) => {
    registerAllMcpTools(server);
  },
  {
    // Semua tool di sini request-response murni, tidak ada server-push,
    // jadi SSE subscription tidak dibutuhkan -- cegah koneksi menggantung
    // sampai hit 300s timeout Vercel.
    maxSubscriptions: 0,
  }
);

const verifyToken = async (_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;

  const isValid = await verifyWorkerToken(bearerToken);
  if (!isValid) return undefined;

  return {
    token: bearerToken,
    scopes: ["read:finance"],
    clientId: "financial-app-mcp",
  };
};

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ["read:finance"],
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authHandler as GET, authHandler as POST };
