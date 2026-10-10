# push-row

Baca 1 baris terbaru dari SQLite lokal lalu format jadi payload push Worker — dipakai `shared/cloud-sync/push-on-write/` (push langsung setelah tulis sukses) DAN `shared/cloud-sync/push-queue/` (retry, baca ulang row terbaru). Satu sumber kebenaran supaya kedua jalur (push langsung vs retry) selalu kirim shape payload yang sama.

## Satu fungsi per tabel

`index.ts` (`pushRowPayload`) cuma switch yang memanggil fungsi `push-<tabel>-row.ts` yang sesuai — setiap fungsi baca baris by `id`, map snake_case ke camelCase, lalu panggil `push<Tabel>` di `../worker-client`.

## `infer-content-type.ts`

`transaction_attachments` lokal TIDAK punya kolom `content_type` (skema SENGAJA tidak berubah, lihat `attachment-r2-sync.md`) — infer dari ekstensi file untuk dikirim ke Worker (dipakai Worker untuk header Content-Type saat serve & cari ekstensi `r2_key`). Daftar minimal format foto struk yang realistis dipakai; selain itu fallback `null` (Worker treat sebagai "bin").

## `push-debt-row.ts` dan `push-investment-purchase-row.ts`: skip kalau `transaction_id` null

`transaction_id` null berarti baris belum ter-link ke transaksi (gap terpisah, lihat dokumen rencana) — push di-skip SEMENTARA, endpoint Worker mewajibkan `transactionId`.

Beda dari `investment_sales` (`push-investment-sale-row.ts`) yang MEMANG boleh `transaction_id` null selama `status` masih `pending` — jadi tidak ada skip di situ.

## `push-attachment-row.ts`

Skema lokal TIDAK punya `updated_at` (`id, transaction_id, file_path, created_at` saja, lihat `attachment-r2-sync.md`) — `updatedAt` TIDAK dikirim, Worker pakai `now()` sendiri (SELALU menang, konsisten dengan field opsional di `shared/lww.ts` Worker — attachment TIDAK pernah di-edit setelah dibuat, cuma dibuat/dihapus, jadi tidak ada risiko menimpa perubahan lain yang lebih baru).

## `push-label-junction-row.ts`

3 junction table attach label (`transaction_labels`/`category_labels`/`account_labels`) — SAMA bentuk query/push, cuma beda nama tabel/kolom FK (lihat JUNCTION di `apps/worker/src/modules/labels/service.ts`, pola identik di sini). Satu fungsi menangani ketiganya lewat tabel lookup `JUNCTION`, bukan tiga file terpisah, karena bedanya murni data (nama kolom), bukan logic.
