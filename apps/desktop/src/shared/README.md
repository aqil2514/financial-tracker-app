# `shared/`

Kapabilitas lintas-domain — dipasang ke satu atau beberapa entitas
lain, bukan entitas mandiri itu sendiri. Ciri-cirinya:

- **Bukan entitas mandiri.** Tidak akan pernah punya halaman sendiri di
  `app/`, karena secara UX tidak masuk akal berdiri sendiri (mis. tidak
  ada "halaman semua lampiran" terpisah dari transaksi yang memilikinya).
- **Tapi tetap tahu domain/skema tertentu.** Boleh berisi query SQL,
  command Rust, atau aturan relasi ke entitas lain (mis. lampiran tahu
  dirinya terhubung ke transaksi lewat kolom `transaction_id`). Kalau
  sesuatu TIDAK tahu apa-apa soal domain/skema sama sekali, itu murni UI
  generik dan tempatnya bukan di sini.
- **Dipakai dari beberapa tempat**, bukan cuma satu domain — itulah
  alasan ia dipisah, bukan ditaruh langsung di dalam salah satu domain
  yang memakainya.

## Contoh saat ini

- `shared/attachments/` — lampiran foto untuk transaksi (dan berpotensi
  entitas lain nanti). Campuran komponen (uploader, thumbnail) dan domain
  logic (query ke `transaction_attachments`, command Rust
  `save_attachment_bytes`/dst, aturan `transaction_id`) — dipakai dari
  form & list transaksi, serta halaman Settings untuk pengaturan folder
  penyimpanan.
