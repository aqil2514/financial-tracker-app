# Pembelian investasi dari MCP tidak pernah sampai ke desktop, lalu edit manual melahirkan baris duplikat

Ditemukan saat mengecek transfer investasi "Investasi RDPU" (Kantong Utama → Bahana Likuid Syariah Kelas G (Bisnis)) yang dibuat lewat MCP. Transaksinya muncul normal di desktop setelah sync, tapi baris pembelian investasinya tidak pernah ikut tampil. Setelah ditambah manual dari PC, baris itu akhirnya kelihatan — sepintas terlihat seperti "sudah beres", padahal yang sebenarnya terjadi adalah baris baru ditumpuk di atas baris lama yang masih hidup di D1.

## Bagaimana ketahuan

Kronologi (waktu WIB, 10 Okt 2026), direkonstruksi dari D1 prod lewat `wrangler d1 execute --remote`:

1. Transfer investasi dibuat lewat MCP (`create_transaction`, type `transfer`, Kantong Utama → Bahana Likuid Syariah Kelas G (Bisnis), 10.000). Worker menyimpan transaksinya DAN baris `investment_purchases` turunannya (`applyInvestmentTransaction`, dipanggil dari jalur yang sama persis dengan PC — bukan logic terpisah).
2. Desktop sync. Transaksinya muncul. Baris pembelian investasinya **tidak** — tidak ada indikasi error di mana pun.
3. Transfer diedit manual dari PC (sekadar mengubah jam, dari `13:24` jadi `18:24`) supaya baris pembeliannya "muncul". Baris baru lahir dari edit ini dan ter-push ke D1.
4. Dicek ulang di D1: `transaction_id` yang sama punya **2** baris `investment_purchases` hidup (`deleted_at IS NULL`) — satu `sync_source='mcp'` tanggal `13:24`, satu `sync_source='pc'` tanggal `18:24`.

```
01a125a5-cca5…  2026-10-10T13:24  created 11:49:45 UTC  sync_source mcp
01a125bb-fbff…  2026-10-10T18:24  created 12:14:00 UTC  sync_source pc
```

Dicek lebih luas: dari 7 baris `investment_purchases`, 6 `investment_sales`, dan 2 `investment_accounts` ber-`sync_source='mcp'` di D1, nyaris semuanya adalah data `[TEST]` dari sesi uji 2026-10-08 yang sudah soft-deleted. Yang benar-benar hidup dan nyata hanya baris transfer RDPU ini — jadi dampak datanya kecil, tapi bug kodenya berlaku untuk SEMUA pembelian/penjualan/akun investasi yang lahir dari MCP, bukan cuma baris ini.

## Root cause

### Worker mengirim 3 tabel investment di `/sync`, desktop hanya menerapkan sebagian dari daftar tabel non-investment

Arah MCP/PC → D1 sudah benar sejak awal: `applyInvestmentTransaction` di `apps/worker/src/modules/investments/service.ts` dipanggil dari `transactions/service.ts` SETELAH baris `transactions` tersimpan, tidak peduli baris itu lahir dari push desktop atau dari tool MCP — satu jalur yang sama.

Arah D1 → desktop (pull) yang bocor:

- `apps/worker/src/modules/sync/service.ts` SUDAH mengirim `investmentAccounts`, `investmentPurchases`, `investmentSales` di response `/sync` — ketiganya ada di query `Promise.all` dan di mapping balasan.
- `apps/desktop/src/shared/cloud-sync/pull-sync.ts` (`applySyncResponse`) hanya melakukan loop utk 11 koleksi (`accountGroups`, `categories`, `contacts`, `accounts`, `transactions`, `debts`, `debtPayments`, `labels`, 3 junction label). **Ketiga koleksi investment tidak pernah disentuh.**
- `apps/desktop/src/shared/cloud-sync/worker-client.ts` (tipe `SyncResponse`) juga tidak punya field `investmentAccounts`/`investmentPurchases`/`investmentSales` sama sekali — jadi tipenya sendiri sudah lebih dulu drift dari bentuk response Worker yang sebenarnya, dan TypeScript tidak bisa menangkap koleksi yang terlupa karena memang tidak pernah dideklarasikan.

Hasilnya: baris `investment_purchases` dari MCP masuk ke D1 dengan benar, lalu diam di sana selamanya. Desktop menarik transaksinya (karena `transactions` ikut di-apply) tapi membuang baris pembeliannya setiap kali pull jalan.

### Duplikat bukan bug di jalur edit — itu konsekuensi wajar dari DB lokal yang sudah kosong

Saat transfer diedit manual dari PC, desktop beroperasi berdasarkan DB lokalnya sendiri. Karena baris `investment_purchases` dari MCP tidak pernah ada di lokal (poin di atas), jalur edit investasi (`applyInvestmentTransactionEdit`, port dari `apps/desktop/src/shared/investments/apply-investment-transaction.ts`) melihat "belum ada baris pembelian utk transaksi ini" dan membuat satu yang baru — perilakunya benar menurut info yang dimilikinya. Baris baru ini ter-push ke D1 lewat `cloud_sync_queue`, dan karena baris lama di D1 juga tidak pernah tersentuh (tidak ada mekanisme yang tahu baris itu harus di-replace), keduanya hidup berdampingan dengan `transaction_id` yang sama.

Kelas bug ini sama dengan temuan 2026-10-10 lain ([label MCP tidak sampai desktop](2026-10-10-label-mcp-tidak-sampai-desktop-dan-jebakan-checkpoint.md)): push jalan tidak berarti pull jalan, dan gejalanya sama menyesatkan — tidak ada error di mana pun, cuma data yang diam-diam tidak lengkap.

## Perbaikan

### Desktop

Tiga upsert baru ditambahkan di `pull-sync.ts`, diterapkan SETELAH `accounts` + `transactions` (FK `account_id`/`transaction_id` menunjuk ke sana):

- `upsertInvestmentPurchase` dan `upsertInvestmentSale` lewat `applyRow` generik seperti tabel lain (PK `id`).
- `investment_accounts` butuh helper sendiri (`applyInvestmentAccountRow`) karena PK-nya `account_id`, bukan `id` — `applyRow` generik mengasumsikan kolom `id` dan tidak bisa dipakai apa adanya di sini.
- `average_cost_per_unit`/`realized_pl` pada `investment_sales` disalin APA ADANYA dari D1, sama pola dengan `debts`/`debt_payments` (desktop percaya nilai dari Worker, tidak menghitung ulang) — logic jual sendiri (average cost, Realized P/L, validasi oversell) belum diport ke Worker, jadi baris jual yang ada di D1 saat ini selalu lahir dari push desktop dan nilai turunannya sudah benar sejak awal.

Tipe `SyncResponse` di `worker-client.ts` ditambah ketiga field investment yang sebelumnya tidak ada sama sekali.

Diverifikasi:

- `tsc --noEmit` bersih di `apps/desktop`.
- SQL ketiga upsert dijalankan apa adanya terhadap SQLite asli (schema tiruan dari migrasi 0037–0042) — jalur INSERT dan `ON CONFLICT DO UPDATE` dua-duanya benar, `created_at` terisi dari default kolom, nilai NULL turunan (`average_cost_per_unit`/`realized_pl`/`unit`/`price_per_unit`) bulak-balik utuh.
- Tes regresi baru `pull-sync.test.ts`: fake DB in-memory yang mencatat nama tabel tersentuh, memverifikasi SEMUA 15 koleksi `SyncResponse` benar-benar disalurkan ke tabel lokalnya. Dibuktikan tesnya memang menangkap kelas bug ini — loop `investmentPurchases` dihapus sementara, tes gagal dengan diff yang menunjukkan tabel itu hilang, lalu dikembalikan dan tes lewat lagi.

### MCP

Field `date` pada `create_transaction` ditambah `.describe()` yang eksplisit menyebut WIB (UTC+7) dan "ditulis apa adanya tanpa konversi apa pun" — gap terpisah yang ketahuan saat menelusuri bug ini: baris MCP yang jadi duplikat tadi punya jam `13:24` sedangkan `created_at`-nya (UTC, dikonversi ke WIB) sekitar `18:49`, selisih yang tidak wajar utk UTC+7. Tidak ada logic konversi timezone otomatis sama sekali di jalur MCP — `date` murni diisi manual oleh pemanggil tool, jadi perbaikannya bukan logic tapi memperjelas instruksi di skema supaya sesi berikutnya tidak menebak.

### Data (D1 prod)

Satu baris duplikat yang ditemukan disoft-delete:

```sql
UPDATE investment_purchases
SET deleted_at = '2026-10-10 12:30:00', updated_at = '2026-10-10 12:30:00'
WHERE id = '01a125a5-cca5-7ff7-8c9b-58fea2f5f37c'
  AND deleted_at IS NULL;
```

Baris `sync_source='pc'` (jam `18:24`, sesuai jam transaksi saat ini) dipertahankan; baris `sync_source='mcp'` (jam `13:24`, nilai asli sebelum diedit manual) yang dihapus. `updated_at` disertakan supaya soft-delete ini ikut turun ke desktop di pull berikutnya (sekarang jalurnya sudah ada).

Dikonfirmasi setelahnya: `0` transaksi bersisa yang punya baris `investment_purchases` duplikat.

Baris `[TEST]` ber-`sync_source='mcp'` dari sesi uji 2026-10-08 (sudah soft-deleted sebelumnya) TIDAK disentuh — tidak ada yang hidup, tidak ada dampak.

**Checkpoint TIDAK dimundurkan.** Beda dari kasus label 2026-10-10 sebelumnya: baris `investment_purchases`/`investment_sales`/`investment_accounts` yang hidup sekarang hanya satu (baris `pc` yang dipertahankan di atas), dan `updated_at`-nya `12:14:00`/`12:30:00` — keduanya SETELAH checkpoint desktop manapun yang masuk akal di hari yang sama. Pull berikutnya akan menariknya normal tanpa perlu reset. Kalau ternyata ada baris investment lain yang `updated_at`-nya lebih lama dari checkpoint saat ini, baris itu tidak akan tertarik sampai checkpoint dimundurkan — layak dicek kalau suatu saat laporan investasi di desktop kelihatan tidak lengkap meski sync "sukses".

## Catatan untuk ke depan

**Tipe response dan logic penerapan bisa drift sendiri-sendiri.** `SyncResponse` di desktop sudah lebih dulu tidak punya field investment sama sekali, jauh sebelum `applySyncResponse` ditulis — jadi masalahnya bukan sekadar "loop-nya lupa ditulis", tapi definisi tipenya sendiri sudah tidak mencerminkan bentuk response Worker yang sebenarnya. Typecheck tidak bisa menangkap ini karena yang hilang adalah DEKLARASI-nya, bukan penggunaan yang salah tipe. Satu-satunya cara mendeteksinya adalah membandingkan daftar field `SyncResponse` di Worker vs desktop secara manual, atau test yang menegaskan jumlah/nama koleksi yang benar-benar diterapkan.

**Push jalan tidak berarti pull jalan — berlaku juga utk tabel yang "derived" (investment_purchases lahir dari transaksi, bukan tabel independen).** Sama seperti label, tabel yang terlihat "ikut otomatis" lewat jalur lain (di sini: `applyInvestmentTransaction` dipanggil dari service transaksi) tetap perlu dicek eksplisit dari sisi pull — tidak ada jaminan derivasinya ikut tertarik hanya karena transaksi induknya tertarik.

**Gejala "akhirnya muncul setelah diedit manual" bisa menyesatkan.** Baris yang "muncul" itu bukan baris lama yang akhirnya tersinkron, tapi baris BARU yang lahir dari edit itu sendiri. Kalau sync pull memang bermasalah, mengulang aksi lewat jalur lain (edit, re-create) hampir selalu melahirkan duplikat, bukan memperbaiki apa pun — periksa dulu `COUNT(*) GROUP BY transaction_id` sebelum menyimpulkan "sudah beres".
