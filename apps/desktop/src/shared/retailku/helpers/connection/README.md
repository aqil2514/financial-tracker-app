# `mcp-connection`

Koneksi MCP ke Retailku (lihat `docs/todos/plan/retailku-integration.md`) — pakai SDK resmi `@modelcontextprotocol/sdk` (bukan JSON-RPC manual) supaya handshake `initialize`/session-id/format `tools/call` mengikuti spesifikasi protokol persis, sama seperti yang diimplementasikan server Retailku (`McpServer` dari SDK yang sama, lihat `mcp.service.ts` di retail-multitenant).

Sengaja di TypeScript, BUKAN Rust — logic ini murni panggilan HTTP ke API eksternal, bukan sesuatu yang butuh akses sistem/file seperti migrasi SQL atau baca-tulis lampiran foto (yang memang di Rust). `fetch` dari `@tauri-apps/plugin-http` disuntikkan ke transport supaya request-nya native (lewat Rust di baliknya) — TIDAK kena CORS WebView, tanpa perlu menulis satu baris Rust pun untuk logic pemanggilannya.

## Pembagian file

- `connect.ts` — KHUSUS buka koneksi. Validasi kredensial ada di `credentials.ts`, pemanggilan tool spesifik (`get_cashflow_detail`, `get_ar_ap`, dst) ada di `../mcp-tools/`.
- `credentials.ts` — validasi kredensial tersimpan sudah lengkap sebelum dipakai.
- `index.ts` — re-export publik folder ini.

## `connectRetailkuMcp`

Buka koneksi MCP baru ke Retailku dan langsung `connect()` (melakukan handshake `initialize`) — caller bertanggung jawab menutup koneksi (`client.close()`) setelah selesai, idealnya lewat `using`/`finally`.

Cast `tauriFetch as unknown as typeof fetch`: `FetchLike` (SDK) dan tipe fetch dari `plugin-http` sama-sama mengikuti signature Fetch API standar, cuma union `RequestInit`-nya sedikit berbeda secara struktural (`ClientOptions` tambahan di `plugin-http`) — aman karena dipanggil SDK persis seperti fetch biasa.

## `RetailkuNotConfiguredError`

Error kontrol alir spesifik untuk kredensial belum lengkap — dibedakan dari error jaringan/HTTP supaya caller (UI) bisa tampilkan pesan yang tepat ("lengkapi pengaturan dulu" vs "gagal terhubung ke server").

## `assertRetailkuConfigured`

Validasi kredensial tersimpan sudah lengkap sebelum dipakai — lempar `RetailkuNotConfiguredError` kalau belum, supaya caller tidak perlu cek null berulang.
