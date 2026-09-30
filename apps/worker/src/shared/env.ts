export interface Env {
  DB: D1Database;
  // Token statis PC<->Worker, terpisah dari OAuth-shim MCP server
  // (lihat docs/todos/plan/cloud-sync.md "Autentikasi PC<->Worker").
  // Di-set via `wrangler secret put PC_SYNC_TOKEN`, TIDAK ditulis di
  // wrangler.toml.
  PC_SYNC_TOKEN: string;
}
