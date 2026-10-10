# use-cloud-sync-settings

Kredensial + status fitur cloud sync (lihat `docs/todos/plan/mcp-server-cloud-mirror.md`) — disimpan di tabel `settings` key-value, pola SAMA dengan `use-retailku-settings.ts`.

Plaintext di SQLite lokal (keputusan sadar, SAMA alasannya dengan `retailku_api_key` meski scope token ini lebih besar — lihat dokumen di atas "Keamanan token").

## `keys.ts`: checkpoint sync vs checkpoint attachment TERPISAH

`ATTACHMENTS_CHECKPOINT_KEY` terpisah dari `LAST_CHECKPOINT_KEY` — `GET /attachments?since=` punya siklus `updated_at` sendiri (tabel `transaction_attachments` di D1, request terpisah dari `GET /sync`), lihat `attachment-r2-sync.md`. Menyamakan dengan checkpoint `/sync` akan salah kalau kedua request tidak selalu sukses bareng (satu gagal, satu berhasil — checkpoint gabungan akan maju untuk yang gagal juga).

## `types.ts`

- `lastCheckpoint`: timestamp pull terakhir (format "YYYY-MM-DD HH:mm:ss", SAMA dengan `updated_at` di Worker) — dikirim sebagai `?since=` pull berikutnya. `null` berarti belum pernah pull sama sekali (first sync, Worker akan balas full snapshot).
- `lastAttachmentsCheckpoint`: checkpoint terpisah untuk `GET /attachments?since=` — lihat `keys.ts`.

## `use-set-cloud-sync-settings.ts`

Simpan toggle + kredensial (dipanggil dari form Settings). TIDAK menyentuh `lastCheckpoint` — itu field internal, diupdate otomatis oleh logic pull (`useSetCloudSyncCheckpoint`), bukan oleh user.

## `use-set-cloud-sync-checkpoint.ts`

Update checkpoint SETELAH pull berhasil — dipanggil dari logic pull (bukan dari UI Settings), TIDAK menampilkan toast (operasi internal/background, bukan aksi user eksplisit).

## `use-set-attachments-checkpoint.ts`

Sama seperti `use-set-cloud-sync-checkpoint.ts`, checkpoint TERPISAH untuk `GET /attachments?since=` — lihat `keys.ts`.
