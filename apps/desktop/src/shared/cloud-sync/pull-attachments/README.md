# pull-attachments

Pull lampiran transaksi dari Worker/R2 — lihat `apps/worker/docs/todos/plan/attachment-r2-sync.md`, "Sisi desktop: push & pull".

## Beda dari `pull-sync/`

`pull-sync/` (tabel data biasa) pakai LWW `updated_at` incoming vs lokal. Attachment TIDAK — tidak ada "versi lama vs baru" untuk satu file: begitu ada row attachment baru dari Worker yang filenya belum ada lokal, cukup DOWNLOAD SEKALI, tidak ada compare `updated_at` (skema lokal bahkan tidak punya kolom itu).

## Urutan panggil: SETELAH `applySyncResponse`

Dipanggil dari `useAutoPullSync` bareng `applySyncResponse` (tabel data biasa), TAPI setelahnya — `pullAttachments` butuh transaksi induknya SUDAH ada lokal (lihat `has-local-transaction.ts`). Kalau transaksi induk belum ada lokal (race / pull parsial), attachment itu di-skip — akan ke-pull lagi next cycle setelah transaksi induknya datang (checkpoint belum maju karena pull saat ini masih dianggap belum lengkap untuk baris itu).

## Checkpoint terpisah dari `/sync`

`targetDir` sama dengan yang dipakai `useAddAttachment` (`attachment_folder` setting, `null` = folder default app data dir Rust-side).

Return `checkpoint` — caller (`useAutoPullSync`) yang simpan via `useSetAttachmentsCheckpoint` SETELAH `pullAttachments` resolve sukses, sama pola dengan `applySyncResponse`/`response.checkpoint`. Checkpoint ini TERPISAH dari checkpoint `/sync` karena endpoint/tabel D1-nya juga terpisah — lihat `listAttachmentsSince` di `../worker-client.ts`.

## `delete-local-attachment.ts`

Row sudah di-hard-delete dari R2 di sisi Worker — kalau masih ada lokal, hapus file fisik dulu (best-effort, sama pola `use-delete-attachment.ts`) baru hapus row.

## `download-local-attachment.ts`

Attachment baru dari device/HP lain. Dipanggil hanya setelah dipastikan transaksi induknya ada lokal dan baris attachment-nya belum ada lokal (keduanya dicek di `index.ts` sebelum memanggil ini).
