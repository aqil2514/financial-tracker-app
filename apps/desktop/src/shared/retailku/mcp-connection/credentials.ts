import type { RetailkuSettings } from "../mcp-hooks/use-retailku-settings";
import type { RetailkuMcpConfig } from "./connect";

export class RetailkuNotConfiguredError extends Error {
  constructor() {
    super("Pengaturan Retailku (URL MCP/API Key) belum lengkap.");
    this.name = "RetailkuNotConfiguredError";
  }
}

export function assertRetailkuConfigured(settings: RetailkuSettings): RetailkuMcpConfig {
  if (!settings.mcpUrl || !settings.apiKey) {
    throw new RetailkuNotConfiguredError();
  }
  return { mcpUrl: settings.mcpUrl, apiKey: settings.apiKey };
}
