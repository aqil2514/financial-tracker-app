# Porting Label (Desktop → Mobile)

## Status & TODO saat ini (ringkas)

CRUD kamus label dan sync dua arah untuk kamusnya sudah ada di mobile. Belum terhubung ke entitas manapun (junction, form, filter belum). Alasan dan konteks tiap poin ada di bagian "Catatan teknis" dan "Status Worker" di bawah.

- [x] Cek dukungan Worker — sudah lengkap, tidak perlu perubahan Worker (lihat "Status Worker").
- [x] CRUD kamus label lokal: migrasi `0015_labels.ts` (tabel `labels` saja), layar `/labels`, menu Lainnya → Master Data → Label. Detail skema di `docs/tables/label.md`.
- [ ] Keputusan scope: label di transaksi saja, atau juga akun dan kategori.
- [ ] Baca logika label desktop (`apps/desktop/src/shared/labels/`) — lihat "Catatan teknis" soal label efektif/primer.
- [ ] Migrasi mobile untuk `labels`, `account_labels`, `category_labels`, `transaction_labels` — acuan skema `apps/desktop/docs/tables/label.md`.
- [x] Sync kamus `labels`: pull di `apply-sync-response.ts`, push `POST/DELETE /labels`, migrasi `0016_labels_sync.ts` (antrean + trigger).
- [ ] Sync junction: pull `transactionLabels`, `categoryLabels`, `accountLabels` dan push attach/detach — menunggu tabel junction dan keputusan scope.
- [ ] Worker: `POST /labels` dengan nama+scope yang sama dengan label soft-deleted (atau id lain) kena UNIQUE dan gagal — lihat "Catatan teknis".
- [ ] Form transaksi: field pilih/pasang label dengan pencarian.
- [ ] Filter "Label" di daftar transaksi.
- [ ] Label di form akun dan kategori — tergantung keputusan scope.
- [ ] Manajemen label (ganti nama, hapus) — belum ada UI di desktop maupun mobile, lihat "Catatan teknis".
- [ ] Verifikasi hasil terhadap desktop dengan data yang sama, termasuk label hasil sync dari PC.

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
- `POST /labels` di Worker meng-INSERT baris baru kalau id belum ada, padahal `UNIQUE (name, scope)` juga mencakup baris yang sudah soft-deleted. Akibatnya hapus label di HP lalu buat ulang dengan nama sama: push baru gagal (entry antrean menandai error, berhenti otomatis setelah 5 percobaan) selama baris lama di Worker masih ada. Perbaikan idealnya di Worker (revive baris soft-deleted bernama sama), belum dikerjakan.
