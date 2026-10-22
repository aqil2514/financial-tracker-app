import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { RetailkuSettings } from "../mcp-hooks/use-retailku-settings";

export type RetailkuMcpConfig = {
  [K in keyof RetailkuSettings]: NonNullable<RetailkuSettings[K]>;
};

export async function connectRetailkuMcp(config: RetailkuMcpConfig): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(config.mcpUrl), {
    fetch: tauriFetch as unknown as typeof fetch,
    requestInit: {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    },
  });

  const client = new Client({ name: "financial-app", version: "1.0.0" });
  await client.connect(transport);
  return client;
}
