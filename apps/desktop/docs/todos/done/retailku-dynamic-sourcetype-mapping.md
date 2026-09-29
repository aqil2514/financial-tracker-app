# Mapping dinamis per `sourceType` Retailku (menggantikan pendekatan AR/AP generik)

> **Status (2026-09-26): RANCANGAN AWAL, BELUM ADA KODE.** Menggantikan
> arah lama di `retailku-ar-ap-via-cashflow-detail.md` (dokumen itu
> DITUTUP, lihat penutup di sana) — scope melebar dari "AR/AP saja"
> menjadi arsitektur umum: **tiap `sourceType` Retailku bisa punya
> bentuk key mapping SENDIRI, dengan field yang berbeda-beda**, bukan
> 1 pola `<accountId>:<sourceType>:<arah>` seragam untuk semua kasus.

## Latar belakang — kenapa pendekatan lama tidak cukup

Sesi 2026-09-24 s.d. 2026-09-26 membangun sync AR/AP (piutang/utang)
lewat `get_cashflow_detail` yang diperluas (`isReceivablePayableAccount`,
`receivablePayableDirection`) — lihat
`retailku-ar-ap-via-cashflow-detail.md` untuk histori lengkap. Sesi
2026-09-26 (lanjutan) MENEMUKAN beberapa gap struktural sambil mencoba
menyempurnakan fitur itu:

1. **Akun kas AR/AP generik** — user KONFIRMASI eksplisit: "kalau di
   Retailku, pelunasan atau penambahan utang piutang itu tidak terpaku
   dari 1 akun saja". Field "Akun Kas untuk Utang Piutang" sekarang 1
   akun generik, padahal transaksi AR/AP riil bisa lewat metode
   pembayaran apa pun (Kas Tunai, Seabank, dst) tergantung transaksi
   aslinya — DIVERIFIKASI nyata: `SL-260926-05` (utang consignment)
   pasangannya "Kas Tunai", bukan akun generik yang dikonfigurasi.

2. **Percobaan pairing otomatis dari `journal_items` mentah** (cari
   baris kas lain dalam journal entry yang sama via `sourceNumber`+
   timestamp) — BEKERJA untuk `sourceType` settlement murni
   (`CONSIGNMENT_SETTLEMENT`, entry HANYA 2 item), TAPI GAGAL untuk
   `sourceType: SALE` — DIVERIFIKASI ke toko RIIL "Warung Aqil" via
   docker (`multi-retail-db`, journal entry `0807ceba-...`,
   `SL-260620-01`): transaksi PPOB Rp 8000 py 5 item jurnal sekaligus
   (kas + payout provider + piutang + revenue + HPP) — nilai kas TIDAK
   match 1:1 ke nilai piutang, pairing otomatis SALAH mengira payout
   provider ikut jadi "pasangan" piutang.

3. **`SalePaymentLine`** (Prisma model, `sale-transaction.prisma`)
   ditemukan sebagai sumber LEBIH AKURAT khusus utk `sourceType: SALE`
   — `saleTransactionId + accountId + amount`, PERSIS metode
   pembayaran yang diterima dari pelanggan, TIDAK tercampur
   payout-provider/HPP. TAPI ini cuma solusi utk `SALE` — sourceType
   lain (`FUND_TRANSFER`, dst) butuh sumber datanya SENDIRI lagi.

4. **`FUND_TRANSFER`** — DITEMUKAN kasus SEJENIS tapi LEBIH SEDERHANA:
   `get_cashflow_detail` memecah 1 transfer dana jadi 2 baris independen
   (akun asal credit, akun tujuan debit, `sourceNumber`+timestamp sama)
   — sync SEKARANG memperlakukan keduanya sebagai `income`/`expense`
   terpisah (SALAH secara konsep — ini naturnya SATU transfer). MCP
   tool TERPISAH `get_fund_transfer_detail`/`get_fund_transfer_list`
   SUDAH punya `fromAccount`+`toAccount` eksplisit (id/code/name) —
   sumber data yang dibutuhkan justru sudah tersedia, tinggal
   dimanfaatkan.

**Kesimpulan**: pola 1-akun (`key = <accountId>:<sourceType>:<arah>`)
yang dipakai cashflow biasa TIDAK CUKUP UMUM. Tiap `sourceType` bisa
butuh:
- Jumlah akun berbeda (1 utk SALE biasa, 2 utk FUND_TRANSFER, dst).
- Sumber data tambahan berbeda (`journal_items` mentah cukup utk
  settlement murni, `SalePaymentLine` utk SALE, `get_fund_transfer_*`
  utk FUND_TRANSFER).
- Field non-fakta yang relevan berbeda (kontak jadi wajib utk AR/AP,
  tidak relevan utk FUND_TRANSFER).

Solusinya: **skema per-`sourceType`, bukan 1 skema seragam** — baik di
level TIPE DATA (TypeScript) maupun FORM (UI mapping).

## Prinsip rancangan

1. **`sourceType` sebagai unit organisasi utama** — BUKAN akun/role
   Retailku (`accountCode`/`AccountMappingRole`). Alasan (dari diskusi
   user): financial-app SINGLE-ENTRY berbasis PERISTIWA (income/
   expense/transfer + note/kategori/kontak), BUKAN double-entry
   berbasis AKUN NERACA seperti Retailku — `sourceType` (SALE,
   FUND_TRANSFER, CONSIGNMENT_SETTLEMENT, dst) itu PERISTIWA BISNIS,
   selaras dgn cara financial-app berpikir. `role`/`accountCode`
   Retailku (1500/1700/dst) itu artefak double-entry, kurang selaras.
2. **Key TETAP dinamis mengikuti struktur yang dibutuhkan tiap
   `sourceType`** — BUKAN 1 bentuk key seragam. Skema per-`sourceType`
   didefinisikan eksplisit (Zod), field wajib beda-beda:
   - `FUND_TRANSFER`: `{ fromAccountId, toAccountId }` — KEDUANYA
     WAJIB, kalau salah satu tidak bisa ditentukan dari
     `get_fund_transfer_detail` -> baris DITOLAK/di-skip (skipReason
     baru), TIDAK dipaksakan diproses dengan data tidak lengkap.
   - `SALE` (kalau menyentuh AR/AP) -> butuh `direction` +
     kemungkinan data tambahan dari `SalePaymentLine`.
   - `sourceType` settlement murni -> cukup 1 akun kas dari pairing
     `journal_items` (SUDAH terbukti reliable utk kasus ini).
   - `sourceType` LAIN yang belum py kebutuhan khusus -> TETAP pakai
     pola lama (`detail:<accountId>:<sourceType>:<arah>`), TIDAK semua
     `sourceType` perlu skema baru — cuma yang BUTUH data
     tambahan/struktur beda.
3. **Validasi struktural di level TIPE, bukan cuma runtime** — tiap
   skema per-`sourceType` py Zod schema SENDIRI, digabung lewat
   discriminated union ATAU (mengikuti preseden `transactions/form/
   add-edit`, LIHAT "Riset pola form" di bawah) flat-object +
   `superRefine` + validasi manual di hook — keputusan MANA yang
   dipakai lihat "Keputusan terbuka #1" di bawah.
4. **Form mapping UI ikut dinamis** — RHF + Zod + shadcn, field yang
   dirender BERBEDA tergantung `sourceType` key yang sedang diedit user
   (1 dropdown akun vs 2 dropdown akun "Pengirim"/"Penerima", dst).

## Riset pola form existing (WAJIB diikuti, JANGAN reinvent)

Preseden SATU-SATUNYA form multi-bentuk di codebase:
`features/transactions/form/add-edit/` (`schema.ts` +
`hooks/use-transaction-form.ts` +
`hooks/use-transaction-debt-fields.ts` + `fields/debt-action-field.tsx`).
**TIDAK ADA pemakaian `z.discriminatedUnion` di manapun** pada folder
`features/` — pola yang established:

1. **Schema Zod FLAT** (satu `z.object`, semua field kemungkinan
   digabung jadi optional/nullable), validasi kondisional lewat
   `.superRefine` UNTUK YANG BISA dinyatakan sebagai aturan Zod murni
   (mis. "kalau `type==='transfer'`, `transfer_account_id` wajib").
2. **Validasi yang LEBIH KOMPLEKS** (butuh data dari luar schema, mis.
   query `ongoingDebts`) TIDAK dipaksakan ke Zod — dilempar ke FUNGSI
   VALIDASI MANUAL terpisah (`validateDebtFields(values)`) yang
   dipanggil di `handleSubmit`, errornya di-set manual via
   `form.setError(field, { message })`.
3. **State turunan** (`sourceIsDebt`, `needsDebtAction`, dst) dihitung
   di HOOK terpisah pakai `useWatch({ control, name })` + lookup JS
   biasa (BUKAN Zod, BUKAN computed di dalam schema).
4. **Render kondisional** murni JSX ternary di komponen form
   (`{type === "transfer" ? <FieldA/> : <FieldB/>}`), field yang tidak
   relevan di-`disabled` (bukan selalu disembunyikan) kalau konteksnya
   "terkunci" (`debtFieldsLocked`).
5. Form primitif SELALU lewat wrapper proyek sendiri
   (`@/components/forms/form-fields`: `FormFieldText`,
   `FormFieldCurrency`, `FormFieldSelect`, `FormFieldCombobox`, dst) —
   BUKAN `<FormField>`/`<FormControl>` shadcn dipakai telanjang.

**Rancangan form mapping dinamis WAJIB ikuti pola ini** (Zod flat +
superRefine + hook derived-state + JSX ternary + wrapper form-fields
existing) — BUKAN bikin pola form baru sendiri.

## Struktur `retailku_sync_field_mapping` saat ini (dipertahankan/diperluas, BUKAN diganti)

Kolom (migrasi `0020_retailku_sync_field_mapping.sql`): `id, key (TEXT
UNIQUE), retailku_account_id, retailku_account_code,
retailku_account_name, local_account_id (NOT NULL FK accounts), note
(nullable), category_id (nullable FK categories), description
(nullable), created_at, updated_at`.

Tempat baca/tulis existing (SEMUA perlu disentuh utk mendukung key
dinamis baru):
- `shared/sync/cashflow/helpers/load-field-mapping.ts` —
  `loadFieldMapping(db)`, dipakai `compute-cashflow-sync.ts` saat sync
  sungguhan jalan.
- `shared/retailku/mcp-hooks/use-field-mapping.ts` — `useFieldMapping()`
  (baca semua baris utk UI tab Mapping) + `useSaveFieldMapping()`
  (`useDbMutation`, upsert per baris by `key`).
- `contents/mapping/context/hooks/use-load-mapping-keys.ts` — panggil
  `computeCashflowSync` (read-only) utk hasilkan daftar `key` kandidat
  di suatu rentang tanggal, dibandingkan dgn `useFieldMapping()` (di
  `use-mapping-draft.ts`) utk tahu key mana yg `alreadyMapped`.

**Keterbatasan skema kolom SAAT INI utk key dinamis**: `local_account_id`
tunggal TIDAK CUKUP utk `FUND_TRANSFER` (butuh 2 akun: dari+ke). PERLU
keputusan skema (lihat "Keputusan terbuka #2").

## Struktur discriminant (disepakati 2026-09-26, DIKOREKSI dalam sesi yang sama — baca sampai akhir bagian ini)

**Alasan filosofis dari user TETAP BERLAKU dan PENTING**: pilih
discriminant yang FUNDAMENTAL/STABIL, bukan yang cuma detail
implementasi Retailku yang bisa berubah sewaktu-waktu. Ini prinsip yg
BENAR dan dipakai seterusnya di dokumen ini.

**TAPI implementasi pertama dari prinsip itu (draft awal bagian ini)
SALAH, DIKOREKSI SAAT MASIH DITULIS (belum sempat jadi kode) —
dicatat apa adanya sbg pembelajaran, bukan dihapus diam-diam**: draft
awal bilang `isReceivablePayableAccount: false` -> otomatis "GENERIK,
1 akun cukup". Ini DIBANTAH oleh `FUND_TRANSFER` sendiri — DIVERIFIKASI
ke docker: `FUND_TRANSFER` SELALU `isReceivablePayableAccount: false`
(tidak pernah sentuh akun 1500/1700/1800/2100/2200/2300, cuma
1101/1102/5201), TAPI TETAP butuh skema 2-akun (`fromAccountId`+
`toAccountId`), BUKAN 1-akun generik. Jadi `isReceivablePayableAccount`
HANYA menjawab "apakah ini piutang/utang", BUKAN "apakah strukturnya
generik/spesial" secara umum — dia TIDAK BISA jadi discriminant TUNGGAL
yang menentukan seluruh percabangan generik/spesial.

**Struktur yang DIPAKAI (setelah koreksi)**: klasifikasi generik/spesial
dilakukan LANGSUNG per-`sourceType` (lihat tabel "Klasifikasi 10
sourceType" di bawah — tabel ini SUDAH memperhitungkan baik kasus
AR/AP maupun kasus non-AR/AP seperti FUND_TRANSFER sekaligus, TIDAK
perlu lapis `isReceivablePayableAccount` terpisah di ATAS-nya).
`isReceivablePayableAccount` TETAP relevan tapi sbg **SALAH SATU
SINYAL** yang dibaca DI DALAM penentuan variant `sourceType` mana yg
spesial (mis. kenapa `SALE` py 2 variant berbeda — dgn/tanpa AR/AP),
BUKAN sbg lapis discriminant PALING LUAR:

```
discriminatedUnion by sourceType:
  GENERIC_SOURCE_TYPES (enum/set) -> generik, 1 akun, pola lama
  "FUND_TRANSFER" -> spesial: {fromAccountId, toAccountId}, KEDUANYA wajib
  "CONSIGNMENT_SETTLEMENT" -> spesial: 1 akun kas dari pairing journal_items
  "SALE" -> BERCABANG lagi by isReceivablePayableAccount? (KEMUNGKINAN,
            BELUM DIPUTUSKAN — lihat Keputusan terbuka #3 baru)
  "DIRECT_PURCHASE" -> sama polanya dgn SALE (BELUM diverifikasi detail,
            BELUM diputuskan)
  "SALE_PAYMENT" -> spesial: sumber data BELUM diputuskan (Keputusan #2)
  sourceType lain yg belum diklasifikasikan -> SKIP + dialog konfirmasi
```

**PENTING — bagian di atas (percabangan detail dalam variant `SALE`/
`DIRECT_PURCHASE`) BELUM DIPUTUSKAN, dibahas SEBAGAI DISKUSI TERBUKA
di sesi berikutnya** (user eksplisit: "itu nanti jadi diskusi terbuka
di sesi selanjutnya") — lihat Keputusan terbuka #3. JANGAN
diimplementasikan dari asumsi di diagram di atas tanpa konfirmasi
ulang ke user dulu.

## Klasifikasi 10 `sourceType` (DIVERIFIKASI 2026-09-26 via docker `multi-retail-db`, toko "Warung Aqil")

Diambil dari distribusi nyata rentang 2026-09-01 s.d. 2026-09-09 (data
`get_cashflow_detail` yg sudah diunduh sesi sebelumnya) — user MINTA
cakupan tahap FE ini mengikuti apa yg SERING MUNCUL di data nyata,
bukan asumsi.

| `sourceType` | Frekuensi | Klasifikasi | Verifikasi |
|---|---|---|---|
| `SALE` | 158x | **BERCABANG** — generik default, spesial kalau ada item AR/AP | `SL-260620-01` (Warung Aqil): 5 item/entry saat kompleks (kas+payout+piutang+revenue+HPP) |
| `INVESTMENT_TRANSACTION` | 9x | Generik | avg 2.04 item/entry, TIDAK sentuh AR/AP (query docker) |
| `CASH_OPNAME` | 9x | Generik | avg 2.00 item/entry, TIDAK sentuh AR/AP |
| `FUND_TRANSFER` | 6x | **Spesial** | 2 akun eksplisit (`fromAccount`/`toAccount`), `get_fund_transfer_detail` |
| `PURCHASE_ORDER` | 5x | Generik | avg 2.00 item/entry, **TIDAK PERNAH** sentuh AR/AP (0 baris ditemukan) |
| `SALE_PAYMENT` | 4x | **Spesial** (settlement) | Pelunasan piutang dagang — BELUM diverifikasi sumber data granular (`SalePaymentLine` atau cukup `journal_items`?), lihat Keputusan terbuka #2 |
| `OPERATIONAL_EXPENSE` | 3x | Generik | avg 2.00 item/entry, TIDAK sentuh AR/AP |
| `OTHER_INCOME` | 2x | Generik | avg 2.00 item/entry, TIDAK sentuh AR/AP |
| `DIRECT_PURCHASE` | 2x | **BERCABANG** — generik default, spesial kalau ada item AR/AP | avg 2.12 item/entry (sebagian 3 item, tapi item ke-3 = akun inventory `isTrackedAsset:false`, TIDAK ikut ke `get_cashflow_detail`); DITEMUKAN py entry yg sentuh 1700 "Piutang Supplier" |
| `CONSIGNMENT_SETTLEMENT` | 2x | **Spesial** (settlement) | Diverifikasi sesi lalu (`KS-260908-01`), aman pakai pairing `journal_items` |

**Ringkasan**: 6 murni generik (`INVESTMENT_TRANSACTION`,
`CASH_OPNAME`, `PURCHASE_ORDER`, `OPERATIONAL_EXPENSE`,
`OTHER_INCOME`, dan turunannya) tidak butuh skema baru sama sekali. 2
murni spesial dengan sumber data JELAS (`FUND_TRANSFER`,
`CONSIGNMENT_SETTLEMENT`). 2 bercabang (`SALE`, `DIRECT_PURCHASE`) —
variant AR/AP-nya BELUM diimplementasikan penuh (`SalePaymentLine`
utk `SALE` sudah diverifikasi tapi belum terintegrasi ke MCP; pola
serupa utk `DIRECT_PURCHASE` BELUM dicek sama sekali — JANGAN asumsikan
sama dgn `SALE` tanpa verifikasi ulang). 1 (`SALE_PAYMENT`) masih
terbuka soal sumber datanya.

## Strategi eksekusi: bertahap, diklasifikasikan eksplisit (disepakati 2026-09-26, direvisi 2x sesi lanjutan)

User EKSPLISIT minta pendekatan BERTAHAP, bukan rancang-semua-sekaligus.

**KOREKSI PENTING (ditemukan SAAT menulis bagian ini, sebelum sempat
salah diimplementasikan)**: `isReceivablePayableAccount: false` TIDAK
otomatis berarti "1 akun generik cukup" — DIVERIFIKASI ke docker
`multi-retail-db`: `FUND_TRANSFER` SELALU `isReceivablePayableAccount:
false` (tidak pernah sentuh akun 1500/1700/1800/2100/2200/2300, cuma
1101/1102/5201), TAPI tetap butuh skema 2-akun (`fromAccountId`+
`toAccountId`), BUKAN pola generik 1-akun. Jadi `isReceivablePayableAccount`
BUKAN discriminant TUNGGAL yang cukup — dia cuma menjawab "apakah ini
kasus PIUTANG/UTANG", bukan "apakah strukturnya generik/spesial"
secara umum. Klasifikasi generik/spesial yang SEBENARNYA dipakai
adalah TABEL "Klasifikasi 10 sourceType" di atas (per-`sourceType`
langsung, SUDAH memperhitungkan baik AR/AP maupun kasus lain seperti
FUND_TRANSFER) — bukan `isReceivablePayableAccount` sebagai lapis
terpisah. `isReceivablePayableAccount` TETAP relevan sbg SATU dari
BEBERAPA sinyal yang menentukan skema spesial mana yang dipakai (di
antara sourceType yang sudah spesial), TAPI TIDAK bisa jadi discriminant
tunggal/pertama yang menentukan "generik vs spesial" scr umum.

Klasifikasi PRAKTIS (dipakai, bukan draft yang dikoreksi di atas):
setiap `sourceType` diklasifikasikan LANGSUNG (lihat tabel di atas) —
`GENERIC_SOURCE_TYPES` (enum/set eksplisit di kode) utk yang generik,
`discriminatedUnion` per `sourceType` utk yang spesial (`FUND_TRANSFER`,
`CONSIGNMENT_SETTLEMENT`, `SALE`-dgn-AR/AP, `DIRECT_PURCHASE`-dgn-AR/AP,
`SALE_PAYMENT`, dst). Dibangun SATU per satu — mulai dari
**`FUND_TRANSFER` LEBIH DULU** (paling sederhana, sudah terverifikasi
lengkap datanya lewat MCP, TIDAK menyentuh AR/AP sama sekali — jadi
pembuktian konsep discriminatedUnion per-`sourceType` yg PALING
SEDERHANA, sebelum masuk variant AR/AP yg lebih kompleks).
3. **`sourceType` BELUM diklasifikasikan** (belum masuk enum generik,
   belum py skema spesial) — DI-SKIP, **TIDAK diproses diam-diam**.
   User DIBERI TAHU lewat **DIALOG KONFIRMASI eksplisit** (bukan cuma
   toast/badge pasif yang mudah terlewat) bahwa ada `sourceType` yang
   belum didukung ditemukan di rentang sync — supaya user SADAR AKTIF
   ada gap, developer bisa diminta menambahkan klasifikasinya.

Urutan kerja konkret sesi berikutnya:
1. Definisikan `GENERIC_SOURCE_TYPES` (enum/set) — isi awal: semua
   `sourceType` yang SUDAH terverifikasi aman dgn pola lama (SALE
   biasa TANPA AR/AP, PURCHASE_ORDER, DIRECT_PURCHASE, dst — lihat
   tabel kandidat di atas kolom "TIDAK ADA PERUBAHAN dibutuhkan") DAN
   `sourceType` settlement murni yg py 1 akun kas jelas
   (CONSIGNMENT_SETTLEMENT, kemungkinan SALE_PAYMENT setelah dicek).
2. Bangun mekanisme deteksi + dialog utk `sourceType` YANG TIDAK ADA
   di `GENERIC_SOURCE_TYPES` DAN TIDAK PUNYA skema spesial — baris
   itu di-skip, dialog muncul menyebut `sourceType` apa saja yang
   ketemu tapi belum didukung.
3. Implementasikan skema spesial PERTAMA: `FUND_TRANSFER` (Zod schema
   `{fromAccountId, toAccountId}`, keduanya wajib, tolak kalau salah
   satu tidak bisa ditentukan dari `get_fund_transfer_detail`) + form
   mapping UI 2-dropdown (ikuti pola `transactions/form/add-edit`,
   lihat "Riset pola form" di atas) + insert sbg transaksi `transfer`
   TUNGGAL (bukan 2 income/expense terpisah spt sekarang).
4. SETELAH `FUND_TRANSFER` selesai & diverifikasi ke `finance.dev.db`
   nyata — baru lanjut ke `sourceType` spesial BERIKUTNYA (SALE
   dengan AR/AP, dst) satu per satu, ULANGI proses verifikasi yang
   sama (jangan asumsikan pola `FUND_TRANSFER` otomatis benar utk
   sourceType lain tanpa dicek ulang ke data nyata).

## Keputusan terbuka (BELUM diputuskan, WAJIB dibahas sebelum kode ditulis)

1. ~~Bentuk gabungan skema di TypeScript~~ — **DIPUTUSKAN (2026-09-26):
   `z.discriminatedUnion` per `sourceType`.** SADAR ini menyalahi
   preseden codebase (`transactions/form/add-edit` pakai flat-object +
   `superRefine`, TIDAK PERNAH `discriminatedUnion` — lihat "Riset pola
   form" di atas) — keputusan SADAR memilih type-safety compile-time
   (skema per-`sourceType` beda struktur field WAJIB, discriminated
   union memaksa TypeScript sendiri yang menjaga itu) di atas
   konsistensi preseden lama. Implikasi: bagian "Riset pola form" &
   "Rancangan form mapping dinamis WAJIB ikuti pola ini" DI ATAS PERLU
   DIREVISI sesi berikutnya — validasi Zod BOLEH pakai
   `discriminatedUnion`, TAPI mekanisme render form (`useWatch` + JSX
   ternary + wrapper `form-fields` existing) TETAP DIPAKAI (itu bagian
   RENDER, bukan bagian SKEMA — tidak bertentangan dgn keputusan ini).
2. **Skema kolom `retailku_sync_field_mapping`**: MASIH TERBUKA, dibahas
   di SESI BARU terpisah (bukan sesi ini). Tambah kolom
   `secondary_account_id` (nullable, dipakai FUND_TRANSFER sbg
   `toAccountId` sementara `local_account_id` jadi `fromAccountId`) VS
   tabel BARU terpisah khusus key yang butuh >1 akun VS simpan sbg JSON
   di kolom baru (`extra_fields TEXT` berisi JSON, fleksibel utk
   `sourceType` apa pun tanpa migrasi kolom berulang). **BUTUH
   KEPUTUSAN USER** — trade-off: kolom eksplisit (type-safe, query-able)
   vs JSON (fleksibel, tapi query/validasi jadi runtime).
3. ~~Cakupan MVP~~ — **TERJAWAB** (lihat "Strategi eksekusi" di atas):
   bertahap, `FUND_TRANSFER` duluan, `sourceType` lain menyusul satu
   per satu.
4. **`DRY_RUN = true`** di `shared/sync/cashflow/sync-cashflow.ts`
   MASIH AKTIF (dipasang sesi lalu utk investigasi tanpa menulis ke
   `finance.dev.db`) — JANGAN LUPA di-nonaktifkan setelah rancangan ini
   final & diimplementasikan, ATAU kalau mau lanjut testing manual
   dulu sebelum rancangan final.
5. **Percabangan detail di dalam variant `SALE`/`DIRECT_PURCHASE`**
   (apakah bercabang lagi by `isReceivablePayableAccount` di dalam
   discriminatedUnion sourceType, seperti digambarkan di "Struktur
   discriminant" di atas, atau bentuk lain) — user EKSPLISIT tunda ke
   SESI BERIKUTNYA ("itu nanti jadi diskusi terbuka di sesi
   selanjutnya"). **JANGAN diimplementasikan dari diagram di atas
   tanpa konfirmasi ulang** — diagram itu CONTOH KEMUNGKINAN, BUKAN
   keputusan final.
6. **SEMUA detail teknis FE** (lokasi komponen form baru — komponen
   terpisah sbg pembuktian konsep VS langsung terintegrasi ke tab
   Mapping existing `MappingField`/`field-mapping-row.tsx`, struktur
   folder, dst) — user EKSPLISIT: **"Semua diskusi soal FE jadi diskusi
   terbuka di sesi selanjutnya"**. Sesi ini BERHENTI di tahap
   rancangan/dokumen — **TIDAK ADA kode form/schema.ts/komponen React
   apa pun yang ditulis** utk fitur ini sepanjang sesi ini (BEDA dari
   `DRY_RUN`/logging yang MEMANG sudah ada di kode produksi, itu murni
   utk debugging manual, bukan bagian implementasi fitur ini). Sesi
   berikutnya MULAI DARI NOL utk kode FE — jangan asumsikan ada
   progress kode yang sudah dimulai.

## Referensi

- `docs/todos/plan/retailku-ar-ap-via-cashflow-detail.md` — histori
  lengkap AR/AP sampai ditemukannya gap yang melahirkan dokumen ini
  (DITUTUP, tidak dilanjutkan — baca utk KONTEKS HISTORIS saja).
- `docs/todos/plan/retailku-sync-field-mapping.md` — desain ASLI
  `retailku_sync_field_mapping` (kenapa keyed by string, bukan kolom
  terpisah per dimensi).
- `docs/rules/checking-dev-database.md` — WAJIB diikuti saat verifikasi
  implementasi nanti ke `finance.dev.db`.
