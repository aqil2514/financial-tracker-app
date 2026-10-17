# Arah Akun Utang Piutang (`debt_accounts`)

## Status & TODO saat ini (ringkas)

Penjelasan lengkap kenapa tiap poin ada di sini — lihat bagian "Latar belakang", "Bug kedua yang ditemukan", dan "Rencana pendekatan" di bawah.

- [x] Migrasi skema: tabel detail `debt_accounts` (1:1 dengan `accounts`, pola sama `investment_accounts`), kolom `direction` — migrasi `0050_debt_accounts.sql` (awalnya `'receivable' | 'payable' | 'both'`), lalu `0051_debt_accounts_direction_required.sql` **menghapus opsi `'both'`** (lihat "Perubahan besar dari rencana awal" di bawah).
- [x] Backfill data existing — dilakukan di migrasi 0050 untuk 3 akun debt produksi (semua sudah benar arahnya, tidak ada yang perlu direklasifikasi saat migrasi 0051 mengetatkan constraint).
- [x] Form "Tambah Akun" (`features/accounts/`): field "Arah" (`field-debt.tsx`) muncul kondisional saat `account_type === 'debt'`, hanya 2 opsi (Piutang/Utang, tanpa "Keduanya").
- [x] `new-debt-form.tsx`: dropdown "Akun Utang Piutang" difilter berdasar `direction` yang cocok `debt_type` form — auto-select kalau cuma 1 opsi cocok, pesan eksplisit kalau tidak ada akun yang cocok.
- [x] `applyDebtTransaction` (`apply-debt-transaction/create.ts`): **ditulis ulang total**, bukan cuma "validasi keras ditambahkan" seperti rencana awal — `direction` akun debt sekarang jadi SATU-SATUNYA sumber kebenaran untuk `debts.type` di Jalur 1 (transfer), parameter `debtAction` yang dulu dikirim dari UI dihapus total (lihat "Perubahan besar dari rencana awal"). Error baru `DebtAccountDirectionMissingError` kalau akun debt belum punya `direction` ter-set.
- [x] UI jalur transfer (`field-debt-action.tsx`, `use-transaction-debt-fields.ts`, `use-transaction-form.ts`, `use-ongoing-debts.ts`): toggle "Pelunasan vs Utang baru" **dihapus** — arah ditentukan otomatis dari `direction` akun, bukan pilihan manual user. *(Belum dikomit saat dokumen ini ditulis — lihat "Riwayat implementasi".)*
- [x] **Jalur 2 CREATE** (`create-transaction/income/debt.ts`, `.../expense/debt.ts`): ditulis ulang — fungsi baru `applyDirectDebtTransaction` (`apply-debt-transaction/apply-direct-debt-transaction.ts`) menentukan lahir-baru vs pelunasan FIFO dari `debt_accounts.direction`, menggantikan hardcode lama (income selalu → `receivable`, expense selalu → `payable`) yang sudah terbukti SALAH — ini persis bug original yang memulai investigasi ini. UI (`use-transaction-debt-fields.ts`) ikut direvisi supaya checklist pelunasan muncul untuk income/expense juga, bukan cuma transfer. Test baru `apply-direct-debt-transaction.test.ts`. *(Belum dikomit.)*
- [ ] **Jalur 2 UPDATE — sengaja BELUM disentuh** (keputusan user 2026-10-17, scope dibatasi create dulu). `update-transaction/income/debt.ts` dan `.../expense/debt.ts` masih hardcode `'receivable'`/`'payable'` seperti versi create yang lama — mengedit transaksi income/expense existing di akun debt (ganti tipe/akun/nominal) masih bisa menghasilkan `debts.type` yang salah. Perlu redesign alur ganti "debt baru" <-> "pelunasan" saat field berbahaya berubah, mirip kompleksitas `applyDebtTransactionEdit` (`edit.ts`) untuk Jalur 1.
- [ ] **Port skema + validasi ke `apps/worker`**: `apps/worker/src/modules/accounts/service.ts` perlu kolom `direction` yang sama (migrasi D1 terpisah), dan `createDirectDebt` (`apps/worker/src/modules/debts/service.ts:543`) wajib validasi `direction` vs `type` SEBELUM insert — saat ini cuma validasi `accountType === 'debt'`. Belum dimulai.
- [ ] **Verifikasi tool MCP `create_debt_direct`** (`apps/mcp-server/src/lib/mcp-tools/debts/create-debt-direct.ts`) — deskripsi tool perlu diperbarui menyebut constraint arah akun begitu Worker selesai. Belum dimulai.
- [ ] Cleanup baris `debts` lama yang salah kategori (`01a13e62-cf6d...` kontak Kak Ipit, `01a14492-eb7f...` data uji coba) — dilakukan user manual lewat UI, BUKAN lewat SQL langsung. Belum dilakukan.
- [ ] Smoke test manual Worker (`wrangler dev` lokal) — belum dimulai, menunggu Jalur 2 + port Worker selesai.
- [x] Smoke test manual desktop untuk Jalur 1 — diverifikasi langsung ke `finance.dev.db` (bukan cuma toast UI) tanggal 2026-10-17, lihat "Riwayat implementasi".

## Perubahan besar dari rencana awal

Dua hal berubah signifikan dari rencana yang ditulis pertama kali di bawah ("Rencana pendekatan") — dokumen itu ditulis SEBELUM bug kedua ditemukan via dogfooding lanjutan. Bagian "Rencana pendekatan" di bawah dipertahankan apa adanya sebagai catatan sejarah/alasan desain awal, tapi detail berikut sudah menggantikannya:

### 1. `direction = 'both'` dihapus total, bukan dipertahankan untuk akun netral

Rencana awal mempertahankan `'both'` untuk akun generik seperti "Keluarga"/"Orang Lain"/"Bisnis" yang secara histori dipakai dua arah. Setelah didiskusikan ulang, diputuskan: **setiap akun debt WAJIB `receivable` ATAU `payable`, tidak ada netral.** Kalau kebutuhannya mencatat dua arah ke pihak yang sama, itu harus dua akun terpisah (mis. "Piutang Keluarga"/"Utang Keluarga"), bukan satu akun ambigu — karena `direction` sekarang bukan cuma dipakai filter dropdown UI, tapi jadi SATU-SATUNYA input untuk menentukan `debts.type` secara otomatis di `applyDebtTransaction`. Akun `'both'` akan membuat logika itu tidak mungkin ditentukan tanpa input tambahan dari user, yang justru kembali ke masalah "bisa salah pilih" yang ingin dihindari.

Migrasi `0051_debt_accounts_direction_required.sql` mengetatkan `CHECK` constraint ini. Dicek langsung: produksi tidak punya satu pun akun `'both'` yang perlu direklasifikasi (semua 3 akun debt produksi sudah `receivable`/`payable` sejak backfill 0050).

### 2. Ditemukan bug KEDUA via dogfooding lanjutan: arah Jalur 1 (transfer) sendiri awalnya salah logic, dan ada Jalur 2 yang sama sekali belum tercakup rencana awal

Setelah rencana awal ("Rencana pendekatan" di bawah) diimplementasikan parsial, user menemukan transaksi **income** langsung di akun debt `payable` ("Test Utang Baru") melahirkan `debts.type='receivable'` — bukan mengurangi utang seperti seharusnya. Investigasi mengungkap bahwa aturan arah yang benar TIDAK bisa diturunkan dari "uang masuk = bertambah" secara naif (itu kontradiktif untuk Jalur 1 transfer: bayar utang dengan kas MENGURANGI utang, padahal kas "masuk" ke akun debt). Setelah dikoreksi berkali-kali oleh user, aturan final yang disepakati dan sudah diverifikasi konsisten secara logika — didokumentasikan penuh di [docs/concept/konsep-utang-piutang.md](../../../../../docs/concept/konsep-utang-piutang.md):

**Jalur 1 — transfer kas ↔ akun debt:**

| `direction` akun | Arah transfer | Efek |
|---|---|---|
| `payable` | Kas → akun (masuk) | Utang **berkurang** (pelunasan FIFO) |
| `payable` | Akun → kas (keluar) | Utang **bertambah** (debt baru) |
| `receivable` | Kas → akun (masuk) | Piutang **bertambah** (debt baru) |
| `receivable` | Akun → kas (keluar) | Piutang **berkurang** (pelunasan FIFO) |

**Jalur 2 — income/expense langsung di akun debt (belum diimplementasikan di kode):**

| `direction` akun | `type` transaksi | Efek |
|---|---|---|
| `payable` | income | Utang **berkurang** |
| `payable` | expense | Utang **bertambah** (debt baru) |
| `receivable` | income | Piutang **bertambah** (debt baru) |
| `receivable` | expense | Piutang **berkurang** |

Jalur 1 sudah diimplementasikan dan diverifikasi sesuai tabel ini (lihat "Riwayat implementasi"). Jalur 2 masih memakai logika lama yang SALAH untuk kombinasi `payable`+income dan `receivable`+expense — ini adalah pekerjaan utama yang tersisa.

## Riwayat implementasi (Jalur 1)

Dikerjakan dan dikomit `c8280a4` ("Fix konsep utang piutang & penerapan jalur create & unitest"), 2026-10-17:

- `apply-debt-transaction/create.ts` ditulis ulang: parameter `debtAction` (dulu dikirim UI, menentukan "settlement" vs "payable" secara manual) dihapus total. Fungsi sekarang membaca `debt_accounts.direction` lewat `requireDebtAccountDirection()`, throw `DebtAccountDirectionMissingError` kalau akun debt belum punya baris `debt_accounts` sama sekali.
- Comment panjang di kode dipindah ke [apply-debt-transaction/README.md](../../../../src/shared/debts/apply-debt-transaction/README.md) (instruksi eksplisit user: kode minim komentar).
- Test baru `apply-debt-transaction/create.test.ts` (file terpisah, bukan digabung ke test combined lama) — cakupan: income/expense no-op di jalur ini (ditangani Jalur 2 terpisah), semua `AccountPairKind` (`cash-cash`, `debt-debt`, `cash-investment` no-op; `UnsupportedAccountPairError`), `cash-debt`+`receivable` → debt baru, `cash-debt`+`payable` → FIFO settlement, `debt-cash`+`payable` → debt baru, `debt-cash`+`receivable` → FIFO settlement, `DebtAccountDirectionMissingError` untuk kedua arah transfer.
- Bug tambahan ditemukan & diperbaiki saat memperbaiki caller: `pay-debt-form/use-pay-debt.ts` (tombol "Bayar" cepat) selalu mengasumsikan arah transfer `debt → kas`, salah untuk debt `payable` di bawah aturan baru — diperbaiki jadi branch berdasar `debt.type`.
- Diverifikasi ke `finance.dev.db` langsung (bukan cuma toast UI, sesuai [checking-dev-database.md](../checking-dev-database.md)) tanggal 2026-10-17: 4 transaksi uji manual (expense di akun payable, income di akun receivable, transfer masuk/keluar keduanya) — semua `debts.type` dan `debt_payments` yang lahir cocok 100% dengan tabel Jalur 1 di atas.

**Belum dikomit** (status working tree saat dokumen ini ditulis): perbaikan UI lanjutan supaya field checklist pelunasan muncul untuk kombinasi `pairKind`+`direction` yang benar (sebelumnya field itu cuma muncul untuk `debt-cash`, sehingga kombinasi `cash-debt`+`payable` — yang butuh pelunasan FIFO juga — silent no-op karena `settleDebtIds` kosong tidak pernah terisi UI). Perubahan: `use-ongoing-debts.ts` (parameter `type` eksplisit, bukan hardcode `receivable`), `use-transaction-debt-fields.ts` (computed `settlementDirection` dari `pairKind`+`direction`), `use-transaction-form.ts`, `field-debt-action.tsx` (toggle lama dihapus, label checklist dinamis), `transactionSchema`/`values.ts` (field `debt_action` dihapus). Juga ikut dibersihkan 6 file sisa referensi tipe `'both'` yang luput saat migrasi 0051. Diverifikasi `tsc --noEmit` bersih + `vitest run` 251/251 lulus.

Ditemukan saat verifikasi manual Jalur 1 di atas: user sempat menguji income/expense langsung di akun debt juga (bukan cuma transfer) dan hasilnya tampak benar — tapi itu KEBETULAN, bukan bukti Jalur 2 sudah benar (lihat "Bug kedua" di atas). 2 dari 4 kombinasi (`payable`+expense, `receivable`+income) kebetulan cocok dengan hardcode lama; 2 kombinasi lain (`payable`+income, `receivable`+expense) akan tetap salah kalau dicoba.

## Riwayat implementasi (Jalur 2 — CREATE)

Dikerjakan 2026-10-17, sesi lanjutan setelah Jalur 1:

- Fungsi baru `applyDirectDebtTransaction` (`apply-debt-transaction/apply-direct-debt-transaction.ts`) — reuse `requireDebtAccountDirection`/`createDebt` (diekspor dari `create.ts`) dan `settleDebtsFifo` (`settle-fifo.ts`, generik, tidak terikat tipe transaksi). Logic: `direction='payable'`+`expense` atau `direction='receivable'`+`income` → `createDebt`; kombinasi sebaliknya → `settleDebtsFifo`.
- `create-transaction/income/debt.ts` dan `.../expense/debt.ts` ditulis ulang: `INSERT INTO debts` hardcode langsung dihapus, diganti panggilan `applyDirectDebtTransaction` dengan `settleDebtIds: values.settle_debt_ids` (field form yang sama dipakai Jalur 1).
- `use-transaction-debt-fields.ts`: `settlementDirection`/`involvesDebtAccount` diperluas mencakup `type === "income"`/`"expense"` (sebelumnya cuma `type === "transfer"`) — supaya checklist pelunasan muncul di form untuk kombinasi `payable`+income dan `receivable`+expense juga.
- Test baru `apply-direct-debt-transaction.test.ts` (file terpisah, pola sama `create.test.ts`) — 6 test: `payable`+expense → debt baru, `receivable`+income → debt baru, `payable`+income → FIFO settlement, `receivable`+expense → FIFO settlement, `settleDebtIds` kosong → no-op, `DebtAccountDirectionMissingError`.
- Diverifikasi `tsc --noEmit` bersih + `vitest run` 257/257 lulus (33 file). **Belum diverifikasi manual di `finance.dev.db`** — menunggu user uji di `tauri dev` (skenario pembukti: income di akun "Test Utang Baru" yang sudah punya utang `payable` berjalan, harus MENGURANGI utang itu, bukan melahirkan piutang baru ke kontak yang sama).
- **Scope sengaja dibatasi CREATE saja** (keputusan user) — `update-transaction/income|expense/debt.ts` TIDAK disentuh, masih hardcode lama. Lihat TODO di atas.

## Latar belakang

Ditemukan lewat dogfooding manual jalur Utang Piutang — detail reproduksi lengkap (root cause, selisih saldo nyata +Rp20.000) ada di [docs/dogfooding/2026-10-16-form-utang-piutang-dropdown-akun-debt-tidak-difilter-per-jenis.md](../../../../docs/dogfooding/2026-10-16-form-utang-piutang-dropdown-akun-debt-tidak-difilter-per-jenis.md).

Ringkas: form "Tambah Utang/Piutang" (`new-debt-form.tsx`) menampilkan SEMUA akun `account_type='debt'` di dropdown "Akun Utang Piutang" tanpa membedakan apakah akun itu untuk piutang atau utang, dan auto-prefill mengambil akun debt pertama tanpa pertimbangan `debt_type` yang sedang dipilih. Akibatnya entri **Utang** bisa (dan memang) tersimpan dengan akun yang secara nama untuk **Piutang** — saldo kas jadi salah arah saat pelunasan (naik, bukan turun), tanpa error apa pun.

**Ini bukan kasus baru.** Agent riset menemukan insiden identik sudah pernah terjadi di data produksi: migrasi `0033_backfill_direct_debt_transactions.sql` kategori D — debt `type='payable'` bernama "Piutang Retailku" ternyata `account_id` menunjuk akun "Piutang", dikonfirmasi user sendiri sebagai "SALAH INPUT sejak awal", ditambal manual waktu itu. Pola yang sama muncul lagi sekarang — tanda bahwa tambal-sulam di level data tidak cukup, perlu perbaikan struktural.

### Kenapa bukan sekadar bug kode form

Root cause sebenarnya: skema `accounts` tidak punya cara eksplisit membedakan akun debt untuk piutang vs utang — pembedaan murni dari nama akun yang dibaca manusia ("Piutang", "Utang Dagang"). `classifyAccountPair` (`shared/debts/classify-account-pair.ts`) juga murni berbasis `account_type` mentah, tidak pernah melihat identitas akun debt — arah `receivable`/`payable` ditentukan semata dari arah transfer (`account_id` vs `transfer_account_id`), bukan dari akun debt mana yang dipakai. Jadi akun debt di `applyDebtTransaction` hanya berfungsi sebagai "tempat parkir" `account_id` di baris `debts`, bukan pembeda jenis.

(Desain "satu akun debt boleh dipakai 2 arah" yang disebut di `docs/concept/konsep-tipe-akun.md` versi lama — sudah DIBATALKAN, lihat "Perubahan besar dari rencana awal" poin 1.)

### Percobaan pertama yang dibuang

Sempat dicoba pendekatan "warning UI non-blocking" (tanpa ubah skema) — dropdown & prefill dibuat "cerdas" berdasarkan histori pemakaian tiap akun (`COUNT` per `account_id` + `debts.type`), dengan warning kalau akun yang dipilih historinya dominan berlawanan arah. Implementasi awal langsung kena bug logic `useEffect` prefill (re-render tidak konsisten, prefill tidak jalan saat toggle `debt_type`), dan setelah didiskusikan ulang disadari pendekatan ini secara fundamental rapuh — heuristik berbasis histori tidak bisa menjamin apa pun untuk akun baru/jarang dipakai, dan tetap bisa diabaikan user. Diputuskan naik ke pendekatan skema (dokumen ini), mengikuti pola `investment_accounts` yang sudah terbukti di proyek ini untuk kasus serupa (lihat [account-type-investment.md](account-type-investment.md)).

### Worker + MCP juga kena gap yang sama

Dicek eksplisit (bukan diasumsikan) — `apps/worker` punya replika PENUH modul debts (`apps/worker/src/modules/debts/`, termasuk `classify-account-pair.ts` sendiri, pola port yang sama persis dengan investasi, lihat `account-type-investment.md` bagian "Port ke Worker + MCP"). Fungsi `createDirectDebt` (`apps/worker/src/modules/debts/service.ts:543-565`) — dipanggil LANGSUNG dari tool MCP `create_debt_direct` (`apps/mcp-server/src/lib/mcp-tools/debts/create-debt-direct.ts`), BUKAN lewat desktop sama sekali — cuma memvalidasi `accountType === 'debt'`, sama rentan seperti bug yang ditemukan di desktop. **Status: masih belum diperbaiki (lihat TODO).**

**Risikonya lebih tinggi di jalur ini**: yang memilih `accountId` untuk `create_debt_direct` adalah model LLM yang menebak dari daftar akun berdasarkan deskripsi tool (`"Akun bertipe 'debt'"`, tidak menyebut arah sama sekali) — bukan manusia yang melihat UI dengan dropdown terfilter. Tanpa validasi backend, kombinasi `type: 'payable'` + `accountId` akun "Piutang" bisa lolos tanpa penolakan apa pun lewat MCP, bahkan setelah desktop diperbaiki — karena desktop dan Worker adalah dua implementasi terpisah yang harus diperbaiki MASING-MASING (tidak ada kode bersama antara keduanya, cuma pola yang sama).

Konsekuensinya: validasi `direction` vs `type` WAJIB ditambahkan di `createDirectDebt` (Worker), bukan cuma di `applyDebtTransaction` (desktop) — ini bukan "nice to have", karena jalur MCP sama sekali tidak terlindungi oleh perbaikan UI desktop manapun.

## Rencana pendekatan (versi awal — dipertahankan sebagai catatan sejarah)

> Catatan: bagian ini ditulis SEBELUM bug kedua ditemukan dan sebelum keputusan menghapus `'both'`. Beberapa detail di bawah (skema `direction` dengan `'both'`, validasi digambarkan "opsional") sudah DIGANTIKAN oleh "Perubahan besar dari rencana awal" di atas — dipertahankan di sini hanya untuk konteks kenapa pendekatan tabel detail (bukan kolom langsung) dipilih sejak awal.

Pola identik `investment_accounts` (migrasi `0036_investment_accounts_and_purchases.sql`) — tabel detail 1:1, BUKAN kolom baru langsung di `accounts` (yang tetap generik lintas tipe).

```sql
CREATE TABLE debt_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('receivable', 'payable', 'both'))
);
```

- `receivable` — akun ini HANYA untuk piutang (mis. "Piutang", "Piutang Dagang").
- `payable` — akun ini HANYA untuk utang (mis. "Utang Dagang").
- `both` — akun netral, boleh dua arah (mis. "Keluarga", "Orang Lain", "Bisnis" — sesuai histori pemakaian riil mereka saat ini, lihat query di bawah). **(Dihapus di migrasi 0051 — lihat "Perubahan besar dari rencana awal".)**

Tabel baru, tidak direferensikan FK tabel lain — `ALTER TABLE`/`CREATE TABLE` biasa, TIDAK perlu teknik copy-and-rename (`docs/rules/sqlite-copy-and-rename-migration.md`).

### Backfill data existing

Histori pemakaian riil tiap akun debt (dicek lewat `finance.dev.db`, `docs/rules/checking-dev-database.md`, saat dogfooding 2026-10-16):

| Akun | receivable | payable | `direction` backfill |
|---|---|---|---|
| Piutang | 22 | 2 (SALAH, akan dibersihkan manual oleh user) | `receivable` |
| Piutang Dagang | 2 | 0 | `receivable` |
| Utang Dagang | 0 | 2 | `payable` |
| Keluarga | 2 | 0 | `both` (nama netral, histori kebetulan baru 1 arah) |
| Orang Lain | 3 | 0 | `both` (nama netral) |
| Bisnis | 0 | 0 | `both` (belum ada histori sama sekali, nama netral) |

Backfill ini dijalankan SEKALI sebagai bagian migrasi data (bukan jadi logic heuristik runtime seperti percobaan pertama yang dibuang) — akun baru yang dibuat user SETELAH migrasi ini wajib eksplisit isi `direction` lewat form "Tambah Akun", tidak ada default tebakan.

### Form "Tambah Akun"

`features/accounts/contents/detail/form/add-edit/` — field "Arah" (toggle/select 3 opsi: Piutang saja / Utang saja / Keduanya) muncul kondisional saat `account_type === 'debt'`, pola sama persis field `unit_label`+`current_market_value` yang muncul kondisional saat `account_type === 'investment'` (`field-account-type.tsx`, `use-create-account.ts` insert ke tabel detail setelah insert `accounts`, `use-update-account.ts` upsert manual).

### `new-debt-form.tsx`

Buang total pendekatan histori/prefill-cerdas dari percobaan pertama. Dropdown "Akun Utang Piutang" di-filter LANGSUNG dari `direction`:

```ts
const debtAccounts = accounts?.filter(
  (account) =>
    account.account_type === "debt" &&
    account.is_active &&
    (account.debt_direction === debtType || account.debt_direction === "both")
);
```

Tidak ada lagi prefill naif atau warning rapuh — kalau cuma ada 1 opsi yang cocok, auto-select itu (bukan "akun pertama apa pun"); kalau tidak ada akun yang cocok sama sekali untuk `debt_type` yang dipilih, tampilkan pesan eksplisit ("Belum ada akun Utang — buat dulu lewat Tambah Akun") daripada dropdown kosong tanpa penjelasan.

### `applyDebtTransaction` — defense-in-depth (opsional, didiskusikan saat implementasi)

Tambah validasi di `apply-debt-transaction/create.ts`: kalau akun debt yang dipakai (`transferAccountId` untuk `cash-debt`, `accountId` untuk `debt-cash`) punya `direction` yang eksplisit bertentangan dengan arah yang diminta (`receivable` dipakai padahal `direction='payable'`, atau sebaliknya), throw error baru (pola sama `UnsupportedAccountPairError`/`DebtSelfSettlementError`) — mencegah kasus ini terulang lewat jalur form transaksi utama (`field-transfer-account-or-category.tsx`) juga, bukan cuma `new-debt-form.tsx`. `direction='both'` selalu lolos tanpa validasi tambahan.

### Smoke test manual (checklist, dijalankan saat implementasi selesai)

**Desktop (`tauri dev`)**

1. Buat akun debt baru lewat "Tambah Akun" dengan `direction='payable'` — field "Arah" tersimpan benar, cek `finance.dev.db` (`debt_accounts` punya baris, `direction` sesuai).
2. Dari "Tambah Utang/Piutang", pilih jenis Utang — dropdown "Akun Utang Piutang" HANYA tampilkan akun `payable`/`both`, akun `receivable`-only ("Piutang") tidak muncul sama sekali.
3. Toggle ke Piutang — dropdown berganti ke akun `receivable`/`both`.
4. Buat entri Utang baru, lunasi dari halaman Utang — saldo kas yang dipakai HARUS turun sebesar nominal pelunasan (bukan naik seperti bug awal), diverifikasi query `finance.dev.db` dengan query yang sama persis dengan `useAccountBalances`.
5. Coba kirim payload lewat jalur form transaksi utama (`field-transfer-account-or-category.tsx`, bukan `new-debt-form.tsx`) dengan kombinasi akun yang bertentangan arah — harus ditolak `applyDebtTransaction` dengan pesan jelas, bukan silent-insert salah kategori.
6. `tsc --noEmit` bersih, test vitest existing (`apply-debt-transaction.test.ts` dkk) tetap lulus + test baru untuk validasi direction.

**Worker (`wrangler dev` lokal, BUKAN production — lihat [docs/rules/checking-dev-database.md](../../../../docs/rules/checking-dev-database.md) soal isolasi dev/prod)**

7. Migrasi D1 lokal jalan bersih, `direction` ter-backfill benar untuk akun debt existing (cek `wrangler d1 execute <db> --local`).
8. `POST /debts` (dipanggil `create_debt_direct`) dengan `type: 'payable'` + `accountId` akun yang `direction='receivable'` — expect `422`/rejected dengan pesan jelas, BUKAN insert sukses.
9. Payload yang kombinasinya valid (`type` cocok `direction`, atau akun `direction='both'`) — expect sukses seperti biasa, tidak ada regresi ke jalur yang sudah benar.
10. Jalur `create_transaction` + `debtAction` (transfer kas↔debt biasa, bukan direct) — pastikan `applyDebtTransaction` versi Worker (`classify-account-pair.ts` + service) ikut tervalidasi juga, bukan cuma `createDirectDebt`.

**MCP**

11. Tool `create_debt_direct` — deskripsi tool diperbarui menyebut constraint arah akun; coba panggil dengan kombinasi yang sengaja bertentangan, verifikasi pesan rejected dari Worker diteruskan apa adanya ke response tool (bukan error generik).
12. `get_debt_summary`/tool list lain yang menampilkan akun debt ke LLM — cek apakah perlu menyertakan `direction` di response supaya model bisa memilih akun yang tepat SEBELUM memanggil `create_debt_direct` (mengurangi percobaan gagal), bukan cuma mengandalkan validasi reject setelahnya.

**Cakupan desktop vs Worker/MCP — WAJIB keduanya**, bukan pilih salah satu: gap yang sama ada di dua implementasi terpisah (lihat "Worker + MCP juga kena gap yang sama" di atas), memperbaiki satu tidak melindungi yang lain.
