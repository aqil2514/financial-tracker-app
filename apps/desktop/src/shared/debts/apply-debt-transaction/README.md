# apply-debt-transaction

Logika pencatatan `debts`/`debt_payments` yang dipicu oleh transaksi —
dipecah per concern (create/edit/delete/fifo) dari file tunggal
`apply-debt-transaction.ts` (381 baris sebelum dipecah, 2026-10-15).
Semua caller tetap import dari `@/shared/debts/apply-debt-transaction`
(path folder, resolve ke `index.ts`) — tidak ada caller yang perlu
diubah oleh pemecahan ini.

Lihat juga [docs/concept/konsep-utang-piutang.md](../../../../../docs/concept/konsep-utang-piutang.md)
dan `debt-receivable-tracking.md` untuk konsep di baliknya.

## types.ts

`TouchedDebtRows` + `mergeTouchedDebtRows` — bukan logika bisnis,
melainkan **protokol pelaporan** antara fungsi-fungsi di folder ini dan
caller (`use-create-transaction.ts` dkk). Tanggung jawabnya: memberi
tahu caller baris `debts`/`debt_payments` mana yang DISENTUH (dibuat
ATAU di-UPDATE, mis. `status` jadi `'paid'`) oleh satu panggilan
`applyDebtTransaction`/`applyDebtTransactionEdit`, supaya caller tahu
PERSIS apa yang perlu di-`pushOnWrite` ke Worker — fungsi di sini tidak
lagi satu-satunya penulis D1 (lihat
[docs/todos/plan/fix-debts-duplikasi-sync.md](../../../../../docs/todos/plan/fix-debts-duplikasi-sync.md),
source-based ownership). Baris yang CUMA di-update statusnya (bukan
dibuat baru) TETAP masuk supaya Worker dapat state terbaru, bukan cuma
insert pertama.

`deletedDebtIds`/`deletedDebtPaymentIds`: id baris yang di-HARD-DELETE
lokal sebagai bagian dari RECREATE (field berbahaya berubah,
`applyDebtTransactionEdit` hapus baris lama lalu insert baru dengan id
BARU) — caller WAJIB `pushDeleteOnWrite` untuk id ini, karena
`/debts/push` di Worker cuma upsert-by-id dan TIDAK PERNAH tahu id lama
harus dihapus kalau cuma mengandalkan push baris baru (gap ditemukan
2026-10-05 lewat test manual: baris lama menumpuk selamanya di D1 tanpa
ini).

## create.ts

`applyDebtTransaction` — dipanggil SETELAH insert/update baris
`transactions` selesai (butuh `transactionId` untuk jejak
`debts.transaction_id`/`debt_payments.transaction_id`), sebelum
mutation dianggap selesai — bukan best-effort seperti lampiran, karena
ini bagian inti pencatatan finansial.

Deteksi apakah transfer ini melibatkan akun `account_type='debt'` dan,
kalau ya, buat/update baris `debts`/`debt_payments` yang sesuai —
mengikuti aturan arah di "Deteksi otomatis debts dari transfer"
(`debt-receivable-tracking.md`):

- cash -> debt: piutang baru (`type='receivable'`), tidak ambigu.
- debt -> cash: SELALU butuh `debtAction` eksplisit dari form —
  `'payable'` (utang baru) atau `'settlement'` (lunasi piutang
  existing, FIFO berdasar `settleDebtIds`).
- debt -> debt: tidak melakukan apa-apa (di luar scope, lihat dok).
- `cash-cash`/`cash-investment`: bukan urusan fungsi ini (investment
  ditangani `apply-investment-transaction.ts`).
- kombinasi lain (melibatkan tipe akun ketiga yang belum didukung):
  `classifyAccountPair` throw `UnsupportedAccountPairError`, lihat
  `classify-account-pair.ts` — seharusnya sudah dicegat lebih dulu oleh
  validasi form (`use-transaction-debt-fields.ts`), guard di sini
  adalah safety net.

**Guard `type !== "transfer"` (baris pertama fungsi)** — saat ini
HANYA dipanggil dari jalur transfer; `return none` untuk
`income`/`expense`. Ini TODO terbuka: lihat
[docs/todos/done/unify-direct-writeoff-into-main-transaction-form.md](../../../../../docs/todos/done/unify-direct-writeoff-into-main-transaction-form.md)
— guard ini perlu dibuka supaya income/expense yang direct ke akun
`debt` juga tertangani oleh fungsi ini (bukan insert manual terpisah
seperti pola lama `use-create-debt.ts`), opsi mana yang dipilih BELUM
diputuskan.

**`sourceType == null || destinationType == null` → throw** — null
berarti akun sudah terhapus di antara submit form dan titik ini (race),
BUKAN tipe akun baru — beda kasus dari `UnsupportedAccountPairError`
yang dilempar `classifyAccountPair` untuk kombinasi tipe akun yang
memang belum didukung.

## edit.ts

`DebtEditBlockedError` — error kontrol alir spesifik untuk kasus yang
HARUS diblokir di UI (lihat "Edit transaksi yang sudah py debts
terkait" di `debt-receivable-tracking.md`) — kalau ini benar-benar
terlempar sampai ke user, berarti validasi di `transaction-form.tsx`
gagal mencegahnya duluan (safety net, bukan jalur utama).

`applyDebtTransactionEdit` — versi `applyDebtTransaction` untuk jalur
EDIT transaksi, lihat keputusan lengkap di "Edit transaksi yang sudah
py debts terkait" (`debt-receivable-tracking.md`):

- `status.role === 'none'` (belum pernah trigger apa pun): sama
  seperti create, langsung `applyDebtTransaction`.
- `status.role === 'principal'` (transaksi ini MEMBUAT sebuah `debts`)
  DAN field berbahaya TIDAK berubah: cuma sinkronkan `debts.date` kalau
  tanggal berubah — tidak perlu recreate.
- `principal` DAN field berbahaya berubah DAN `hasPayments` (piutang
  itu sudah dicicil transaksi LAIN): BLOKIR (`DebtEditBlockedError`) —
  recreate akan menghapus cicilan itu lewat CASCADE.
- `principal` DAN field berbahaya berubah DAN belum ada cicilan sama
  sekali: aman untuk recreate — hapus `debts` lama, jalankan
  `applyDebtTransaction` dari nilai baru seperti create.
- `status.role === 'payment'` (transaksi ini adalah SATU
  cicilan/pelunasan) DAN field berbahaya TIDAK berubah: sinkronkan
  `debt_payments.date` saja.
- `payment` DAN field berbahaya berubah: SELALU aman untuk recreate
  (tidak ada yang bergantung pada satu baris `debt_payments`) — hapus
  baris itu, revert `debts.status` ke `'ongoing'` kalau piutangnya
  sempat `'paid'` karena pembayaran ini, lalu `applyDebtTransaction`
  dari nilai baru.

Pada cabang `principal` + recreate: id LAMA ikut dilaporkan sebagai
`deletedDebtIds` — caller WAJIB `pushDeleteOnWrite` supaya Worker
soft-delete baris lama ini juga, BUKAN cuma push baris baru dari
`applyDebtTransaction` (lihat `TouchedDebtRows` di `types.ts`).

Pada cabang `payment` + recreate: setelah `debt_payments` lama dihapus,
piutang induknya mungkin sempat ditandai `'paid'` karena pembayaran
yang baru saja dihapus ini — kalau sekarang ternyata masih ada sisa,
dikembalikan ke `'ongoing'` supaya tidak "hilang" dari daftar berjalan.
`debts.id`-nya ikut ditandai disentuh (status berubah) WALAU row-nya
sendiri tidak dihapus — caller perlu push ulang supaya Worker tahu
status terbaru. `debt_payments.id` lama ikut dilaporkan sebagai
deleted, alasan sama dengan cabang `principal`.

## delete.ts

`detachDebtForDeletedTransaction` — dipanggil SEBELUM hard-delete baris
`transactions` (lihat `use-delete-transaction.ts`), port PERSIS dari
`detachDebtForDeletedTransaction`
(`apps/worker/src/modules/debts/service.ts`), supaya PC TIDAK LAGI diam-
diam kehilangan jejak piutang lewat FK `ON DELETE SET NULL` biasa (gap
lama, lihat "Delete transaksi TIDAK ADA guard sama sekali" di
`mcp-server-business-logic-audit.md`).

Tindakan TUNGGAL per role, TIDAK ada pilihan user (keputusan
2026-10-03, dialog tetap 1 tombol konfirmasi generik — lihat
`cloud-sync.md` "DELETE /transactions/:id"):

- `role: 'none'`: no-op.
- `role: 'payment'`: hapus `debt_payments` ini, revert `debts.status`
  ke `'ongoing'` kalau sempat `'paid'` karena pembayaran ini.
- `role: 'principal'` (BAIK sudah maupun belum dicicil): `debts.
  transaction_id` SET NULL — piutang/cicilan TETAP UTUH secara nominal
  (`remaining` dihitung dari `amount - SUM(debt_payments)`, independen
  dari `transaction_id`), cuma kehilangan jejak transaksi ASAL.

## settle-fifo.ts

`settleDebtsFifo` — given `settleDebtIds` dan `amount`, alokasikan
pembayaran FIFO (urut `date ASC, id ASC`, piutang TERLAMA dulu) ke
piutang-piutang itu: insert `debt_payments` per alokasi, tandai
`debts.status = 'paid'` kalau alokasi menutup penuh sisa
(`remaining`, dihitung via `remainingDebtSql()`). Dipanggil hanya dari
`applyDebtTransaction` cabang `debtAction === "settlement"` — karena
`applyDebtTransactionEdit` juga memanggil `applyDebtTransaction` di 2
cabang recreate-nya, fungsi ini transitif juga dipakai jalur edit.

## apply-debt-transaction.test.ts

Fake DB in-memory yang meniru HANYA pola SQL spesifik yang benar-benar
dipakai di folder ini — bukan SQL parser umum. Dipakai (bukan mock
modul `@/lib/db`) karena `db` diteruskan sebagai parameter fungsi,
bukan diimpor di dalamnya, dan menambah dependency SQLite asli (mis.
`better-sqlite3`) untuk sekadar unit test dianggap berlebihan untuk
cakupan logic yang diuji di sini (murni branching, bukan SQL itu
sendiri — SQL-nya sudah diverifikasi manual lewat simulasi di salinan
`finance.dev.db`, lihat `debt-receivable-tracking.md`).

ID sekarang UUID (TEXT PRIMARY KEY, lihat migrasi
`0027_uuid_primary_keys.sql`) — INSERT menyertakan `id` eksplisit
sebagai parameter pertama (BUKAN lagi `lastInsertId` dari
auto-increment), fake db meniru pola itu persis.

Catatan test case tertentu:
- "melempar UnsupportedAccountPairError untuk kombinasi tipe akun di
  luar cash/debt/cash-investment": tipe fiktif `"forex"` — simulasi
  tipe akun keempat yang belum ditambahkan ke union `account_type`
  sungguhan (lihat `classify-account-pair.ts` dan
  `audit-kepatuhan-konsep-tipe-akun.md` pertanyaan #4: kombinasi tak
  dikenal harus fail loud, bukan diam-diam dianggap no-op/cash).
  `"investment"` TIDAK dipakai lagi di sini sejak tipe itu benar-benar
  ditambahkan (sekarang varian valid `cash-investment`, ditangani
  `apply-investment-transaction.ts`).
- "tidak melakukan apa pun (no-op) untuk transfer cash -> investment":
  `cash-investment` adalah urusan `apply-investment-transaction.ts`,
  BUKAN `apply-debt-transaction` — lihat catatan `pairKind` di atas
  (bagian create.ts).
- "role='principal', SUDAH dicicil ... DIBLOKIR": tidak ada apa pun
  yang berubah — blokir terjadi SEBELUM mutasi apa pun.
- "role='principal', SUDAH dicicil dari transaksi lain" (describe
  `detachDebtForDeletedTransaction`): cicilan dari transaksi LAIN tetap
  utuh — bukan CASCADE/dihapus.
