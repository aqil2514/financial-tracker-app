export interface Env {
  DB: D1Database;
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
