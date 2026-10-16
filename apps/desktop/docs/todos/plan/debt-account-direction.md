# Arah Akun Utang Piutang (`debt_accounts`)

## Status & TODO saat ini (ringkas)

Penjelasan lengkap kenapa tiap poin ada di sini — lihat bagian "Latar belakang" dan "Rencana pendekatan" di bawah.

- [ ] Migrasi skema: tabel detail `debt_accounts` (1:1 dengan `accounts`, pola sama `investment_accounts`), kolom `direction` (`'receivable' | 'payable' | 'both'`).
- [ ] Backfill data existing: tentukan `direction` tiap akun `account_type='debt'` yang sudah ada dari histori pemakaian riil di `debts` (lihat perhitungan di "Latar belakang").
- [ ] Form "Tambah Akun" (`features/accounts/`): field "Arah" muncul kondisional saat `account_type === 'debt'`, pola sama field `unit_label` untuk `account_type === 'investment'`.
- [ ] `new-debt-form.tsx`: dropdown "Akun Utang Piutang" difilter berdasar `direction` yang cocok `debt_type` form (bukan heuristik/histori runtime) — ganti total pendekatan "warning non-blocking" yang sempat dicoba lebih dulu dan terbukti rapuh (lihat "Percobaan pertama yang dibuang" di bawah).
- [ ] `applyDebtTransaction` (`apply-debt-transaction/create.ts`): validasi keras — tolak kombinasi `debt_type` vs `direction` akun yang bertentangan (defense-in-depth backend, bukan cuma UI). **WAJIB, bukan opsional** — lihat "Worker + MCP juga kena gap yang sama" di bawah, jalur MCP tidak punya UI sama sekali untuk mencegah salah pilih akun.
- [ ] **Port skema + validasi ke `apps/worker`**: `accounts` Worker (`apps/worker/src/modules/accounts/service.ts`) perlu tabel/kolom `direction` yang sama (D1, migrasi Worker terpisah dari migrasi SQLite desktop — cek konvensi migrasi Worker sebelum mulai), dan `createDirectDebt` (`apps/worker/src/modules/debts/service.ts:543`) wajib validasi `direction` vs `type` payload SEBELUM insert — saat ini cuma validasi `accountType === 'debt'` (baris 556-565), sama rentan seperti desktop.
- [ ] **Verifikasi tool MCP `create_debt_direct`** (`apps/mcp-server/src/lib/mcp-tools/debts/create-debt-direct.ts`) — tool ini `workerFetch` tipis ke endpoint Worker yang sama, jadi validasi di atas otomatis ikut berlaku; TAPI deskripsi tool (baris 19, 23) perlu diperbarui supaya LLM yang memanggilnya tahu `accountId` harus cocok arah `type`, bukan cuma "akun bertipe debt" — risiko salah pilih akun LEBIH TINGGI di jalur ini karena yang memilih adalah model yang menebak dari daftar, bukan manusia melihat UI.
- [ ] Cleanup 2 baris `debts` lama yang sudah salah kategori (`01a13e62-cf6d...` data riil kontak Kak Ipit, `01a14492-eb7f...` data uji coba) — dilakukan user manual lewat UI setelah fix selesai, BUKAN lewat SQL langsung.
- [ ] Smoke test manual di `tauri dev` DAN endpoint Worker (`wrangler dev` lokal) — lihat checklist di bagian "Rencana pendekatan".

## Latar belakang

Ditemukan lewat dogfooding manual jalur Utang Piutang — detail reproduksi lengkap (root cause, selisih saldo nyata +Rp20.000) ada di [docs/dogfooding/2026-10-16-form-utang-piutang-dropdown-akun-debt-tidak-difilter-per-jenis.md](../../../../docs/dogfooding/2026-10-16-form-utang-piutang-dropdown-akun-debt-tidak-difilter-per-jenis.md).

Ringkas: form "Tambah Utang/Piutang" (`new-debt-form.tsx`) menampilkan SEMUA akun `account_type='debt'` di dropdown "Akun Utang Piutang" tanpa membedakan apakah akun itu untuk piutang atau utang, dan auto-prefill mengambil akun debt pertama tanpa pertimbangan `debt_type` yang sedang dipilih. Akibatnya entri **Utang** bisa (dan memang) tersimpan dengan akun yang secara nama untuk **Piutang** — saldo kas jadi salah arah saat pelunasan (naik, bukan turun), tanpa error apa pun.

**Ini bukan kasus baru.** Agent riset menemukan insiden identik sudah pernah terjadi di data produksi: migrasi `0033_backfill_direct_debt_transactions.sql` kategori D — debt `type='payable'` bernama "Piutang Retailku" ternyata `account_id` menunjuk akun "Piutang", dikonfirmasi user sendiri sebagai "SALAH INPUT sejak awal", ditambal manual waktu itu. Pola yang sama muncul lagi sekarang — tanda bahwa tambal-sulam di level data tidak cukup, perlu perbaikan struktural.

### Kenapa bukan sekadar bug kode form

Root cause sebenarnya: skema `accounts` tidak punya cara eksplisit membedakan akun debt untuk piutang vs utang vs netral — pembedaan murni dari nama akun yang dibaca manusia ("Piutang", "Utang Dagang"). `classifyAccountPair` (`shared/debts/classify-account-pair.ts`) juga murni berbasis `account_type` mentah, tidak pernah melihat identitas akun debt — arah `receivable`/`payable` ditentukan semata dari arah transfer (`account_id` vs `transfer_account_id`), bukan dari akun debt mana yang dipakai. Jadi akun debt di `applyDebtTransaction` hanya berfungsi sebagai "tempat parkir" `account_id` di baris `debts`, bukan pembeda jenis.

Desain "satu akun debt boleh dipakai 2 arah" memang SENGAJA (lihat `docs/concept/konsep-tipe-akun.md` — pembedaan arah ada di kolom `debts.type`, bukan di `accounts`), dan ini valid untuk akun generik seperti "Keluarga"/"Orang Lain"/"Bisnis". Tapi untuk akun yang namanya SPESIFIK ("Piutang", "Utang Dagang"), tidak ada apa pun yang mencegah dipakai untuk arah yang berlawanan dari namanya.

### Percobaan pertama yang dibuang

Sempat dicoba pendekatan "warning UI non-blocking" (tanpa ubah skema) — dropdown & prefill dibuat "cerdas" berdasarkan histori pemakaian tiap akun (`COUNT` per `account_id` + `debts.type`), dengan warning kalau akun yang dipilih historinya dominan berlawanan arah. Implementasi awal langsung kena bug logic `useEffect` prefill (re-render tidak konsisten, prefill tidak jalan saat toggle `debt_type`), dan setelah didiskusikan ulang disadari pendekatan ini secara fundamental rapuh — heuristik berbasis histori tidak bisa menjamin apa pun untuk akun baru/jarang dipakai, dan tetap bisa diabaikan user. Diputuskan naik ke pendekatan skema (dokumen ini), mengikuti pola `investment_accounts` yang sudah terbukti di proyek ini untuk kasus serupa (lihat [account-type-investment.md](account-type-investment.md)).

### Worker + MCP juga kena gap yang sama

Dicek eksplisit (bukan diasumsikan) — `apps/worker` punya replika PENUH modul debts (`apps/worker/src/modules/debts/`, termasuk `classify-account-pair.ts` sendiri, pola port yang sama persis dengan investasi, lihat `account-type-investment.md` bagian "Port ke Worker + MCP"). Fungsi `createDirectDebt` (`apps/worker/src/modules/debts/service.ts:543-565`) — dipanggil LANGSUNG dari tool MCP `create_debt_direct` (`apps/mcp-server/src/lib/mcp-tools/debts/create-debt-direct.ts`), BUKAN lewat desktop sama sekali — cuma memvalidasi `accountType === 'debt'`, sama rentan seperti bug yang ditemukan di desktop.

**Risikonya lebih tinggi di jalur ini**: yang memilih `accountId` untuk `create_debt_direct` adalah model LLM yang menebak dari daftar akun berdasarkan deskripsi tool (`"Akun bertipe 'debt'"`, tidak menyebut arah sama sekali) — bukan manusia yang melihat UI dengan dropdown terfilter. Tanpa validasi backend, kombinasi `type: 'payable'` + `accountId` akun "Piutang" bisa lolos tanpa penolakan apa pun lewat MCP, bahkan setelah desktop diperbaiki — karena desktop dan Worker adalah dua implementasi terpisah yang harus diperbaiki MASING-MASING (tidak ada kode bersama antara keduanya, cuma pola yang sama).

Konsekuensinya: validasi `direction` vs `type` WAJIB ditambahkan di `createDirectDebt` (Worker), bukan cuma di `applyDebtTransaction` (desktop) — ini bukan "nice to have", karena jalur MCP sama sekali tidak terlindungi oleh perbaikan UI desktop manapun.

## Rencana pendekatan

Pola identik `investment_accounts` (migrasi `0036_investment_accounts_and_purchases.sql`) — tabel detail 1:1, BUKAN kolom baru langsung di `accounts` (yang tetap generik lintas tipe).

```sql
CREATE TABLE debt_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('receivable', 'payable', 'both'))
);
```

- `receivable` — akun ini HANYA untuk piutang (mis. "Piutang", "Piutang Dagang").
- `payable` — akun ini HANYA untuk utang (mis. "Utang Dagang").
- `both` — akun netral, boleh dua arah (mis. "Keluarga", "Orang Lain", "Bisnis" — sesuai histori pemakaian riil mereka saat ini, lihat query di bawah).

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
