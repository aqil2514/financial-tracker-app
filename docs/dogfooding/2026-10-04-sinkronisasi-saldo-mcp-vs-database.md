# Saldo MCP vs database lokal tidak sinkron

Bug ditemukan bukan dari review kode atau test otomatis, melainkan
dari **memakai aplikasi ini sendiri** sebagai pencatatan keuangan
sehari-hari (dogfooding) — lewat perbandingan silang antar sumber data
(MCP server vs database lokal) yang mengungkap penyimpangan tak
terduga.

## Bagaimana ketahuan

Diminta membandingkan hasil `get_account_balances` dari MCP server
dengan query langsung ke salinan `finance.db` (desktop, production),
memakai query balance resmi di
[apps/desktop/src/features/reports/use-account-balances.ts](../../apps/desktop/src/features/reports/use-account-balances.ts).
Dari 15 akun aktif, 6 akun punya saldo berbeda antara MCP dan database
lokal — padahal keduanya "seharusnya" merepresentasikan sumber
kebenaran yang sama (D1 lewat Worker).

## Root cause #1 — `category_id` tidak di-precheck sebelum INSERT/UPDATE

Transaksi baru dengan kategori yang **baru dibuat hampir bersamaan**
di desktop bisa gagal push ke Worker: kategori-nya sendiri belum
sempat ter-push ke D1 duluan (push transaksi dan push kategori
berjalan independen, tanpa urutan terjamin), sehingga `INSERT INTO
transactions` kena `SQLITE_CONSTRAINT_FOREIGNKEY` dari kolom
`category_id`. Worker tidak membungkus `insertTransaction`/
`updateTransaction` dengan try/catch, jadi exception ini lolos jadi
**HTTP 500 generik** (bukan 422 yang informatif) — dan `push-on-write.ts`
retry otomatis untuk 500, sehingga transaksi ini terus-menerus gagal
retry di `cloud_sync_queue` tanpa pernah berhasil (satu baris sampai
28 kali percobaan).

Dibuktikan lewat reproduksi nyata: `wrangler dev` lokal + D1 lokal
tanpa kategori itu → payload asli benar-benar menghasilkan 500 persis
sama (`last_error='HTTP 500'`, body `"Internal Server Error"` plain
text — ciri unhandled exception Hono, bukan reject terstruktur).

**Perbaikan:** tambah `validateCategoryExists()` di
[apps/worker/src/modules/transactions/service.ts](../../apps/worker/src/modules/transactions/service.ts),
dipanggil sebelum INSERT (`createTransactionRow`) dan UPDATE
(`updateTransactionRow`). Kategori tidak ditemukan sekarang balas 422
dengan pesan jelas, bukan 500 polos.

## Root cause #2 — `contact_id` eksplisit juga tidak di-precheck

Bug yang sama persis, kolom berbeda. Saat menyiapkan replay transaksi
yang stuck, ditemukan kontak "Wahyu" yang dirujuk transaksi transfer
Uang Gaji→Piutang **tidak ada sama sekali** di D1 production — padahal
asumsi awal (kontak sudah ter-push duluan) salah. `resolveFinalContactId()`
cuma meneruskan `contactId` mentah dari payload tanpa memverifikasi
keberadaannya, sehingga rawan FK violation yang sama seperti kategori.

**Perbaikan:** tambah `validateResolvedContactExists()`, dipanggil
setelah `resolveFinalContactId()` di kedua jalur (create & update),
sebelum INSERT/UPDATE.

**Catatan replay:** untuk kontak yang hilang, replay dilakukan dengan
mengirim `contactName` (bukan `contactId` mentah) supaya Worker
get-or-create kontak itu otomatis lewat `resolveContactId()` — pola
yang sudah ada di desain, bukan tulis manual ke D1.

## Root cause #3 — `violatesDebtAccountRule` bertentangan dengan `docs/concept/konsep-transaksi.md`

Ini bukan bug sinkronisasi — ini aturan bisnis yang sudah usang.

Satu transaksi (`expense` Rp4.500 langsung ke akun bertipe `debt`,
tanpa lewat transfer) ditolak Worker dengan pesan "Transaksi
income/expense tidak boleh menyentuh akun bertipe 'debt' — gunakan
transfer." Aturan ini (`violatesDebtAccountRule`, porting dari
auto-correct UX di `use-transaction-form.ts` desktop) dibuat **lebih
dulu**, sebelum [konsep-transaksi.md](../concept/konsep-transaksi.md)
ada.

`konsep-transaksi.md` kemudian dirumuskan justru untuk menjelaskan
bahwa perubahan nilai akun — termasuk akun Utang/Piutang — **tidak
harus** selalu berupa transfer berpasangan. Secara riil, utang/piutang
bisa bertambah/berkurang secara individual tanpa ada "kas fisik" yang
berpindah dari akun lain (kas virtual) — persis seperti konsep
"transaksi penutup" yang dibahas dokumen itu. Begitu dokumen ini
dibaca ulang dengan teliti: tidak ada satu baris pun yang membatasi
`income`/`expense` cuma sah untuk kasus write-off spesifik — itu cuma
salah satu *contoh*, bukan satu-satunya kasus yang diizinkan.

Jadi `violatesDebtAccountRule` menyempitkan aturan yang sebenarnya
lebih longgar di `konsep-transaksi.md` — kodenya yang menyimpang dari
konsep yang lebih baru dan lebih benar, bukan datanya yang salah.

**Perbaikan:** `violatesDebtAccountRule` dan dua call-site-nya
dihapus total dari
[apps/worker/src/modules/transactions/service.ts](../../apps/worker/src/modules/transactions/service.ts).
Komentar di
[apps/worker/src/shared/account-types.ts](../../apps/worker/src/shared/account-types.ts)
dan
[apps/worker/src/modules/accounts/service.ts](../../apps/worker/src/modules/accounts/service.ts)
diperbarui agar tidak lagi merujuk fungsi yang sudah tidak ada.

**Yang TIDAK diubah (sengaja dipertahankan, beda alasan):**
`correctAccountBalance` (koreksi saldo manual) tetap menolak akun
bertipe `debt` — ini bukan soal "income/expense dilarang untuk debt",
tapi soal jalur teknisnya: `correctAccountBalance` INSERT transaksi
langsung **tanpa** lewat `createTransactionRow`, sehingga
`applyDebtTransaction` tidak pernah terpicu dan data turunan
(`debts`/`debt_payments`) jadi tidak saling menjelaskan dengan saldo
akun — insiden ini sudah terjadi nyata sebelumnya dan terdokumentasi
di [konsep-tipe-akun.md](../concept/konsep-tipe-akun.md)
("Koreksi saldo TIDAK menyentuh data turunan"). `income`/`expense`
biasa lewat `createTransactionRow` punya trade-off yang sama (tidak
otomatis membuat baris `debts`) — tapi itu **diterima secara sadar**
sebagai desain, bukan dicegah dengan menolak transaksinya sama sekali.

## Verifikasi

Setiap fix ditest lokal lewat `wrangler dev` (D1 lokal, terisolasi
dari production) sebelum deploy — termasuk reproduksi persis kondisi
gagal (payload yang sama menghasilkan error yang sama), lalu konfirmasi
fix menghilangkan error itu tanpa regresi di jalur yang masih harus
ditolak.

3 versi Worker di-deploy berurutan ke production. 5 transaksi yang
sempat stuck di `cloud_sync_queue` lokal (gagal push berulang, atau
tidak pernah ter-enqueue sama sekali) direplay manual ke endpoint
production — bukan ditulis langsung ke D1, supaya tetap lewat jalur
validasi/business-logic Worker yang sama seperti push normal. Setelah
itu, 15 akun aktif lewat `get_account_balances` (MCP) cocok sempurna
dengan hasil query database lokal.

## Pelajaran

- **Dogfooding lintas-sumber** (membandingkan MCP vs DB lokal, bukan
  cuma percaya satu sisi) adalah cara efektif menemukan sync bug yang
  tidak muncul dari test unit biasa — keduanya "benar" secara teknis
  (tidak throw), tapi merepresentasikan state yang berbeda.
- Precheck FK yang konsisten penting untuk **semua** kolom yang
  mereferensikan tabel lain (`category_id`, `contact_id`, dst), tidak
  cukup hanya untuk `account_id` — satu kolom yang terlewat tetap bisa
  membuat exception tak tertangani lolos jadi 500.
- Aturan bisnis yang terasa "menjaga integritas data" tetap wajib
  dicek ulang terhadap dokumen konsep yang lebih baru — sebuah aturan
  bisa jadi dibuat sebelum pemahaman penuh tentang domain terbentuk,
  dan terus hidup lama setelah premisnya sudah tidak berlaku, sampai
  sebuah kasus nyata (bukan review kode) membuktikannya.
