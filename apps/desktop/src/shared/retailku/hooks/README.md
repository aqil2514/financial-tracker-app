# `mcp-hooks`

React Query hooks terkait Retailku. File yang didokumentasikan di sini dianggap fondasi yang sengaja dipertahankan — file di folder ini yang TIDAK disebut di README ini belum diaudit/dipertahankan secara sadar, dan jadi kandidat dirapikan atau dihapus begitu bagian terkaitnya (mapping, sync lama) matang direfactor.

## `use-retailku-settings.ts`

Kredensial (`mcpUrl`/`apiKey`) untuk menghubungi MCP server Retailku (lihat `docs/todos/plan/retailku-integration.md`) — disimpan di tabel `settings` (key-value) yang sudah ada, sama seperti `attachment_folder` (`shared/attachments/use-attachment-folder.ts`).

`mcpUrl` disalin apa adanya dari halaman Settings → API Keys Retailku (mis. `"https://api.retailku.com/warung-aqil/mcp"`), TIDAK dipecah jadi server+slug terpisah — Retailku sudah menyediakannya dalam bentuk siap pakai.

BUKAN disimpan di OS keychain/store terenkripsi — diputuskan cukup tabel settings biasa (plaintext di SQLite lokal) karena ini aplikasi desktop single-user, database tidak pernah meninggalkan mesin sendiri kecuali saat memanggil Retailku itu sendiri.

`useRetailkuSettings` baca, `useSetRetailkuSettings` tulis (upsert kedua key sekaligus).

## `use-retailku-mcp-client.ts`

Satu hook yang menggabungkan `useRetailkuSettings` → `assertRetailkuConfigured` → `connectRetailkuMcp` (lihat `../helpers/connection/`) jadi satu `Client` siap pakai, supaya komponen tidak perlu urus ketiga langkah itu sendiri-sendiri.

Connect dilakukan di `useEffect` begitu `settings` tersedia, dan `client.close()` dipanggil otomatis saat effect di-cleanup (unmount, atau `settings` berubah) — dipasang di `useEffect` bukan di luar supaya lifecycle koneksi menyatu dengan lifecycle komponen yang memakainya (lihat `../components/context.tsx`, yang unmount/mount ulang tiap dialog picker ditutup/dibuka karena `DialogPrimitive.Popup` dari base-ui tidak `keepMounted`).

`cancelled` flag menangani race saat effect di-cleanup sebelum `connectRetailkuMcp` selesai (mis. dialog ditutup secepat dibuka) — koneksi yang baru selesai connect setelah cleanup langsung ditutup lagi, tidak disimpan ke state.

Return `RetailkuMcpClientState`, union diskriminasi oleh `status` (`"idle" | "connecting" | "ready" | "error"`) — caller cukup cek `status === "ready"` untuk dapat `client` yang non-null (TypeScript narrow otomatis).
