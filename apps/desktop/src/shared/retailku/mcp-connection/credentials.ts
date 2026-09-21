import type { RetailkuSettings } from "../mcp-hooks/use-retailku-settings";
import type { RetailkuMcpConfig } from "./connect";

/**
 * Error kontrol alir spesifik untuk kredensial belum lengkap — dibedakan
 * dari error jaringan/HTTP supaya caller (UI) bisa tampilkan pesan yang
 * tepat ("lengkapi pengaturan dulu" vs "gagal terhubung ke server").
 */
export class RetailkuNotConfiguredError extends Error {
  constructor() {
    super("Pengaturan Retailku (URL MCP/API Key) belum lengkap.");
    this.name = "RetailkuNotConfiguredError";
  }
}

/** Validasi kredensial tersimpan sudah lengkap sebelum dipakai — lempar
 * `RetailkuNotConfiguredError` kalau belum, supaya caller tidak perlu
 * cek null berulang. */
export function assertRetailkuConfigured(settings: RetailkuSettings): RetailkuMcpConfig {
  if (!settings.mcpUrl || !settings.apiKey) {
    throw new RetailkuNotConfiguredError();
  }
  return { mcpUrl: settings.mcpUrl, apiKey: settings.apiKey };
}
