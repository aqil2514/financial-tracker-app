# Porting Label (Desktop → Mobile)

## Status & TODO saat ini (ringkas)

Label sudah berfungsi di mobile mengikuti desktop: kamus, tiga junction, sync dua arah, field label di form transaksi/akun/kategori, dan filter Label di daftar transaksi. Sisanya verifikasi lapangan dan fitur turunan. Alasan dan konteks tiap poin ada di bagian "Catatan teknis" dan "Status Worker" di bawah.

- [x] Cek dukungan Worker — sudah lengkap, tidak perlu perubahan Worker (lihat "Status Worker").
- [x] CRUD kamus label lokal: migrasi `0015_labels.ts` (tabel `labels` saja), layar `/labels`, menu Lainnya → Master Data → Label. Detail skema di `docs/tables/label.md`.
- [x] Keputusan scope: ikut desktop, ketiganya (transaksi, kategori, akun). Diputuskan 2026-11-06.
- [x] Logika label desktop dibaca: apply-*-labels, resolve-label-ids, effective-label-subquery diporting. `primary-label-subquery` (breakdown cashflow per label) dan `aggregate-by-label` (investasi) belum.
- [x] Migrasi junction `0017_label_junctions.ts` (+ perluasan antrean sync).
- [x] Sync kamus `labels`: pull di `apply-sync-response.ts`, push `POST/DELETE /labels`, migrasi `0016_labels_sync.ts` (antrean + trigger).
- [x] Sync junction: pull tiga junction, push attach `POST /labels/:scope/:entityId`, detach `DELETE .../:labelId` (payload antrean).
- [x] Worker: `POST /labels` tidak lagi gagal saat nama+scope sama dengan label soft-deleted (lihat "Catatan teknis"). Ter-deploy ke produksi 2026-11-06 (dari riwayat `wrangler deployments`); belum diuji langsung di produksi dengan hapus lalu buat ulang label bernama sama.
- [x] Form transaksi: field pilih/pasang label dengan pencarian dan buat label baru inline.
- [x] Filter "Label" di daftar transaksi (label efektif: milik transaksi, fallback kategori; juga dipakai ringkasan).
- [x] Label di form akun dan kategori. Form akun di dalam bottom sheet (buat akun dari picker transaksi) sengaja tanpa field label.
- [ ] Manajemen label (ganti nama, hapus) — belum ada UI di desktop maupun mobile, lihat "Catatan teknis".
- [x] Tampilkan label efektif sebagai badge `# nama` di baris daftar Transaksi (`effective-labels.ts`). Daftar akun dan kategori sengaja belum, desktop juga tidak menampilkannya di sana.
- [ ] Verifikasi hasil terhadap desktop dengan data yang sama, termasuk label hasil sync dari PC (belum dicoba di HP).

## Latar belakang

Desktop punya label sebagai tag bebas yang bisa dipasang ke akun, kategori, atau transaksi, lewat tabel `labels` dan tiga tabel junction (`account_labels`, `category_labels`, `transaction_labels`). `labels.scope` dibatasi `transaction_category` atau `account`. Semua tabelnya soft-delete dan ikut sync.

## Status Worker

Worker (`apps/worker/src/modules/labels/`, terdaftar sebagai `/labels`) sudah mendukung label sepenuhnya, jadi porting mobile tidak butuh perubahan Worker.

- CRUD kamus label: `POST /labels`, `GET /labels`, `PATCH /labels/:id`, `DELETE /labels/:id` (soft-delete, LWW).
- Pasang/lepas/daftar per entitas: `POST|GET /labels/:scope/:entityId` dan `DELETE /labels/:scope/:entityId/:labelId`, dengan `:scope` bernilai `transactions`, `categories`, atau `accounts`.
- Re-attach label yang pernah dilepas me-revive baris junction lama (`deleted_at` dikosongkan), bukan baris baru.
- Sync pull (`GET /sync`) sudah mengirim `labels`, `transactionLabels`, `categoryLabels`, dan `accountLabels`.
- MCP punya 7 tool label (create, update, delete, list, attach, detach, list entity labels).
- Dua istilah scope berbeda: `labels.scope` bernilai `transaction_category` atau `account`, sedangkan path attach memakai `transactions|categories|accounts`. Jangan tertukar saat implementasi.

## Catatan teknis

- Re-attach label yang pernah dilepas WAJIB me-revive baris junction lama (`deleted_at` dikosongkan), bukan INSERT baru, karena `UNIQUE (…_id, label_id)` tidak mencakup `deleted_at`.
- Selama sync pull mengabaikan label, label dari PC tidak muncul di mobile, dan edit transaksi di mobile tidak menyentuh label di PC. Tidak ada risiko kehilangan data, hanya fitur yang belum ada.
- Desktop hanya bisa membuat label baru (saat mengetik nama di field label) dan memasang/melepasnya dari entitas. Tidak ada UI atau query di desktop untuk mengganti nama atau menghapus label itu sendiri, jadi label salah ketik atau tak terpakai menumpuk. Mobile cukup meniru perilaku ini.
- Backend manajemen label sudah ada (`PATCH`/`DELETE` di Worker, `update_label`/`delete_label` di MCP), yang kurang hanya UI. Kalau mau dibuat, idealnya di desktop dulu, baru mobile mengikuti.
- Desktop punya turunan label yang dipakai di tempat lain (mis. `aggregate-by-label` untuk rincian investasi, `effective-label-subquery.ts` dan `primary-label-subquery.ts`). Itu belum dibaca dan dipetakan, jadi jangan dianggap ikut selesai saat tabel dan form label jadi.
- `UNIQUE (name, scope)` di Worker mencakup baris soft-deleted, jadi dulu membuat ulang label bernama sama setelah dihapus gagal (500). Sekarang `upsertLabel` melepas nama baris terhapus itu (diganti `"<nama> (dihapus <id>)"`, tombstone tetap ada dan tetap tersebar lewat sync) lalu menyimpan label baru. Sengaja bukan me-revive baris lama: junction yang menunjuk label terhapus tidak di-cascade, jadi revive akan menghidupkan lagi pemasangan lama di label yang baru. Kalau bentrok dengan label yang MASIH hidup (id beda), Worker membalas 422 dan klien menerima label itu lewat pull. Diuji manual di Worker lokal (8799, database terpisah).
