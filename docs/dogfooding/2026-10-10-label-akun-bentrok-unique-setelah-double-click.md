# Label akun gagal ditambah (UNIQUE constraint) setelah double-click saat menyetel label

Ditemukan saat menyetel label "Reksadana Pasar Uang" pada akun investasi "BNI-AM Dana Lancar Syariah" lewat dialog Edit Akun di desktop. Tombol "Simpan Perubahan" terklik dua kali dengan cepat, dua toast hijau "Akun berhasil diperbarui" muncul, tapi label di akun itu tetap kosong. Percobaan menambahkan label berikutnya selalu gagal dengan `error returned from database: (code: 2067) UNIQUE constraint failed: account_labels.account_id, account_labels.label_id` — akun itu jadi mustahil diberi label sama sekali.

## Bagaimana ketahuan

Kronologi (waktu WIB, 10 Okt 2026) — direkonstruksi dari `cloud_sync_queue` di `finance.db`:

1. Akun investasi "BNI-AM Dana Lancar Syariah" belum punya label sama sekali.
2. User menyetel label lewat dialog Edit Akun, lalu klik "Simpan Perubahan" 2x terlalu cepat.
3. Dua toast hijau muncul — keduanya dari mutation `use-update-account` yang resolve normal, tidak ada yang melempar error.
4. Label tetap tidak muncul di akun (UI kosong).
5. Percobaan tambah label berikutnya langsung ditolak SQLite dengan UNIQUE constraint 2067.

Antrian push mencatat tiga INSERT `account_labels` berurutan dalam 16 detik:

| Waktu | Row id | Keterangan |
| --- | --- | --- |
| 01:16:07 | `01a12361-af8d-…` | submit pertama |
| 01:16:16 | `01a12361-d3ce-…` | attach label kedua |
| 01:16:23 | `01a12361-ef75-…` | submit kedua (hasil double-click) |

Baris terakhir berakhir dengan `created_at` **dan** `deleted_at` sama-sama `2026-10-10 01:16:23` — dibuat dan langsung di-soft-delete di detik yang sama, oleh loop detach di `applyAccountLabels` pada submit yang sama.

## Root cause

### 1. `SELECT` memfilter `deleted_at IS NULL`, tapi `UNIQUE` tidak ikut menghitung `deleted_at`

Ini inti masalahnya. Skema `account_labels` (`0045_labels.sql`) memakai `UNIQUE (account_id, label_id)` — **tanpa** `deleted_at`. Artinya baris yang sudah di-soft-delete TETAP memegang slot unik itu.

Sementara `applyAccountLabels` mencari "label apa yang sudah nempel" dengan `... WHERE account_id = $1 AND deleted_at IS NULL`. Baris soft-deleted jadi tidak kelihatan oleh kode, tapi masih sangat kelihatan oleh index UNIQUE. Re-attach label yang sama dianggap "belum ada" lalu di-`INSERT` baru → bentrok 2067.

Efeknya baris soft-deleted itu berada di keadaan mustahil: **tidak ada** menurut UI (difilter keluar oleh `use-account-labels`), tapi **sudah ada** menurut constraint. Akun terkunci — tidak bisa menampilkan label, tidak bisa menerima label.

Double-click bukan penyebabnya, cuma pemicu yang menciptakan baris soft-deleted pertama. Urutan yang sama bisa terjadi tanpa double-click: attach label → detach → attach lagi label yang sama.

### 2. Bug yang sama ada di ketiga junction table

`apply-transaction-labels.ts` dan `apply-category-labels.ts` adalah salinan logika yang sama, dan `transaction_labels`/`category_labels` punya `UNIQUE` tanpa `deleted_at` yang identik. Keduanya belum pernah kena cuma karena urutan attach→detach→attach-lagi belum terjadi di sana.

### 3. Worker sebenarnya sudah benar — desktop yang tidak ikut polanya

`attachLabel` di `apps/worker/src/modules/labels/service.ts` mencari baris junction dengan `WHERE ${column} = ?1 AND label_id = ?2` **tanpa** filter `deleted_at`, lalu menghidupkan kembali baris lama lewat `UPDATE ... SET deleted_at = NULL`. Komentarnya bahkan menjelaskan alasannya persis: "re-attach label yg sudah di-detach dianggap UPDATE biasa (clear deleted_at), BUKAN duplikat baru". Sisi desktop tidak pernah mengadopsi pola itu.

### 4. `disabled={isPending}` tidak cukup mencegah double-submit

Tombol submit sudah dijaga `disabled={isPending}`, tapi `use-update-account` meng-`await pushOnWrite("accounts", …)` — panggilan jaringan ke Worker — di dalam `mutationFn`, sebelum `applyAccountLabels` jalan. Durasi mutation jadi selebar latensi jaringan, cukup lebar untuk klik kedua menyelip sebelum React sempat me-render state `isPending`.

Ini memperbesar jendela balapannya, bukan penyebab utamanya — root cause #1 tetap bisa kena tanpa double-click.

## Dampak data

Satu baris saja, hanya di akun yang kena double-click:

```
01a12361-ef75-756a-81c7-04bf3b0529e2 | BNI-AM Dana Lancar Syariah | Reksadana Pasar Uang
created_at 2026-10-10 01:16:23 | deleted_at 2026-10-10 01:16:23
```

Tidak ada akun, transaksi, atau kategori lain yang terpengaruh (`SELECT COUNT(*) FROM account_labels WHERE deleted_at IS NOT NULL` = 1).

**D1 production bersih.** Keempat tabel label (`labels`, `account_labels`, `category_labels`, `transaction_labels`) kosong semua di D1 — setiap push di antrian gagal dengan `HTTP 404`, jadi tidak ada yang sempat menyeberang ke cloud. Perbaikan cukup lokal.

## Perbaikan

### Kode

Ketiga file `apply-*-labels.ts` diubah mengikuti pola Worker:

- `SELECT` tidak lagi memfilter `deleted_at IS NULL` — ambil semua baris junction berikut kolom `deleted_at`-nya, supaya baris soft-deleted ikut terlihat.
- Label yang diminta dan barisnya sudah ada tapi soft-deleted → `UPDATE ... SET deleted_at = NULL, updated_at = datetime('now')` (dihidupkan kembali), bukan `INSERT` baru.
- Loop detach sekarang melewati baris yang memang sudah soft-deleted, supaya tidak men-detach ulang sesuatu yang sudah mati.

Dengan ini double-click jadi idempotent: submit kedua melihat baris yang sudah ada, tidak menambah apa-apa.

### Data

Baris orphan dihidupkan kembali, bukan dihapus — `id`-nya sudah telanjur masuk `cloud_sync_queue`, jadi mempertahankan `id` yang sama menjaga kesepakatan id lintas device yang diandalkan `attachLabel` Worker:

```sql
UPDATE account_labels
SET deleted_at = NULL, updated_at = datetime('now')
WHERE id = '01a12361-ef75-756a-81c7-04bf3b0529e2' AND deleted_at IS NOT NULL;
```

## Catatan untuk ke depan

Pola "soft-delete + UNIQUE yang tidak menyertakan `deleted_at`" ini akan terus menggigit di tabel mana pun yang memakai keduanya sekaligus. Dua jalan keluar yang konsisten: mencari baris tanpa filter `deleted_at` lalu menghidupkan kembali (yang dipakai di sini, sama dengan Worker), atau mengganti constraint jadi partial unique index `WHERE deleted_at IS NULL`. Yang berbahaya justru mencampur keduanya — `SELECT` yang memfilter `deleted_at` di atas constraint yang tidak, persis seperti kasus ini.
