export interface Env {
  DB: D1Database;
  // Bucket R2 lampiran transaksi (foto struk dkk) — lihat
  // docs/todos/plan/attachment-r2-sync.md utk desain lengkap.
  ATTACHMENTS_BUCKET: R2Bucket;
  // Token statis PC<->Worker, terpisah dari OAuth-shim MCP server
  // (lihat docs/todos/plan/cloud-sync.md "Autentikasi PC<->Worker").
  // Di-set via `wrangler secret put PC_SYNC_TOKEN`, TIDAK ditulis di
  // wrangler.toml.
  PC_SYNC_TOKEN: string;
  // Token statis Worker<->apps/mcp-server, terpisah dari PC_SYNC_TOKEN
  // krn scope beda (mewakili tool MCP dari HP, bukan desktop PC).
  // Di-set via `wrangler secret put MCP_SYNC_TOKEN`, TIDAK ditulis di
  // wrangler.toml.
  MCP_SYNC_TOKEN: string;
}
