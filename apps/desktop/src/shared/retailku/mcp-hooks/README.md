# `mcp-hooks`

React Query hooks terkait Retailku. File yang didokumentasikan di sini dianggap fondasi yang sengaja dipertahankan — file di folder ini yang TIDAK disebut di README ini belum diaudit/dipertahankan secara sadar, dan jadi kandidat dirapikan atau dihapus begitu bagian terkaitnya (mapping, sync lama) matang direfactor.

## `use-retailku-settings.ts`

Kredensial (`mcpUrl`/`apiKey`) untuk menghubungi MCP server Retailku (lihat `docs/todos/plan/retailku-integration.md`) — disimpan di tabel `settings` (key-value) yang sudah ada, sama seperti `attachment_folder` (`shared/attachments/use-attachment-folder.ts`).

`mcpUrl` disalin apa adanya dari halaman Settings → API Keys Retailku (mis. `"https://api.retailku.com/warung-aqil/mcp"`), TIDAK dipecah jadi server+slug terpisah — Retailku sudah menyediakannya dalam bentuk siap pakai.

BUKAN disimpan di OS keychain/store terenkripsi — diputuskan cukup tabel settings biasa (plaintext di SQLite lokal) karena ini aplikasi desktop single-user, database tidak pernah meninggalkan mesin sendiri kecuali saat memanggil Retailku itu sendiri.

`useRetailkuSettings` baca, `useSetRetailkuSettings` tulis (upsert kedua key sekaligus).
