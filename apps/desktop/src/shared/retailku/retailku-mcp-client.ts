import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { RetailkuSettings } from "./use-retailku-settings";

/**
 * MCP client untuk memanggil MCP server Retailku
 * (lihat docs/todos/plan/retailku-integration.md) — pakai SDK resmi
 * `@modelcontextprotocol/sdk` (bukan JSON-RPC manual) supaya handshake
 * `initialize`/session-id/format `tools/call` mengikuti spesifikasi
 * protokol persis, sama seperti yang diimplementasikan server Retailku
 * (`McpServer` dari SDK yang sama, lihat `mcp.service.ts` di
 * retail-multitenant).
 *
 * Sengaja di TypeScript, BUKAN Rust — logic ini murni panggilan HTTP ke
 * API eksternal, bukan sesuatu yang butuh akses sistem/file seperti
 * migrasi SQL atau baca-tulis lampiran foto (yang memang di Rust).
 * `fetch` dari `@tauri-apps/plugin-http` disuntikkan ke transport supaya
 * request-nya native (lewat Rust di baliknya) — TIDAK kena CORS WebView,
 * tanpa perlu menulis satu baris Rust pun untuk logic pemanggilannya.
 */

export type RetailkuMcpConfig = {
  [K in keyof RetailkuSettings]: NonNullable<RetailkuSettings[K]>;
};

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

/**
 * Buka koneksi MCP baru ke Retailku dan langsung `connect()` (melakukan
 * handshake `initialize`) — caller bertanggung jawab menutup koneksi
 * (`client.close()`) setelah selesai, idealnya lewat `using`/`finally`.
 */
export async function connectRetailkuMcp(config: RetailkuMcpConfig): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(config.mcpUrl), {
    // Cast: FetchLike (SDK) dan tipe fetch dari plugin-http sama-sama
    // mengikuti signature Fetch API standar, cuma union RequestInit-nya
    // sedikit berbeda secara struktural (ClientOptions tambahan di
    // plugin-http) — aman karena dipanggil SDK persis seperti fetch biasa.
    fetch: tauriFetch as unknown as typeof fetch,
    requestInit: {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    },
  });

  const client = new Client({ name: "financial-app", version: "1.0.0" });
  await client.connect(transport);
  return client;
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
