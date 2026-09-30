# Handover — 2026-09-28 (sesi 1)

Lanjutan dari `2026-09-27-1-klasifikasi-baris-cashflow-dan-persiapan-agregasi-bertahap.md`
(sesi itu menutup dgn 3 kandidat titik mulai jalur agregasi per
klasifikasi, BELUM dipilih). Sesi ini: (1) menyelesaikan Keputusan
terbuka #2 (skema kolom `retailku_sync_field_mapping` utk key >1 akun),
(2) migrasi form mapping FUND_TRANSFER dari PoC ke PRODUKSI penuh
(tersimpan sungguhan ke DB, diverifikasi), (3) menemukan & memperbaiki
bug desain key transfer, (4) menambah toggle "Mengikuti Retailku" utk
note/description di KEDUA varian (generic + transfer). **BELUM masuk
jalur sync/insert transaksi sungguhan — itu FOKUS EKSPLISIT diminta utk
SESI BARU** (lihat "Lanjut sesi berikutnya" di bawah).

## Ringkasan alur sesi

1. **Keputusan terbuka #2 (skema kolom, dari sesi 26 Sept) DIPUTUSKAN**:
   `secondary_account_id` (migrasi 0023, nullable, FK `accounts`) —
   BUKAN tabel baru terpisah, BUKAN `extra_fields` JSON generik utk ini
   (opsi JSON dipakai utk kebutuhan LAIN, lihat poin 4). Alasan: migrasi
   ringan (`ALTER TABLE ADD COLUMN`), semua baris lama tetap valid tanpa
   backfill, proporsional dgn skala masalah (cuma FUND_TRANSFER yg
   butuh 2 akun sejauh ini, bukan N akun).

2. **Refactor besar struktur form mapping** — folder baru
   `contents/mapping/form/` (BARU, MENGIKUTI preseden
   `transactions/form/add-edit/`: 1 folder per varian, bukan folder
   "dikelompokkan per jenis file"):
   - `form/generic/` — `schema.ts` (Zod flat) + `use-generic-mapping-form.ts`
     (RHF, live-sync `useWatch`→`updateDraft`, TANPA tombol submit
     sendiri) + `generic-mapping-row.tsx`. **MIGRASI dari**
     `contents/field-mapping-row.tsx` (draft-state manual, file lama
     DIHAPUS) — user EKSPLISIT minta ini pas ditanya "form mapping
     structure file bagaimana" & "apakah bisa buat folder khusus utk
     form".
   - `form/fund-transfer/` — sama struktur, **MIGRASI dari**
     `contents/mapping/fund-transfer-poc/` (folder PoC lama DIHAPUS
     sepenuhnya).
   - `form/follow-source-toggle.tsx` (BARU) — komponen SHARED toggle
     "Mengikuti Retailku", generik thd `FieldValues` (RHF), dipakai
     KEDUA form — diekstrak SETELAH ditemukan kebutuhan sama persis di
     generic (lihat poin 5), BUKAN diduplikasi.
   - `form/index.tsx` — `FlexRenderForm(row)`, switch by `row.sourceType`
     (`"generic"` -> `GenericMappingRow`, `"FUND_TRANSFER"` ->
     `FundTransferMappingForm`) — SATU titik render dipakai
     `mapping-field.tsx`, BUKAN pemanggilan langsung tiap varian. User
     EKSPLISIT minta bentuk ini ("index.tsx ini tugasnya render
     berdasarkan tipe... switch case per type").
   - `MappingRowDraft` (di `context/interfaces/use-mapping-candidates.ts`)
     jadi **discriminated union**: `GenericMappingRowDraft |
     TransferMappingRowDraft` — keputusan SADAR (user pilih "tambah
     field sourceType eksplisit" drpd "parse dari key" saat ditanya).
     `MappingRowDraftPatch` (di `use-draft-state.ts`) HARUS union MANUAL
     tiap varian di-`Partial`-kan SENDIRI lalu digabung `&` — `Partial<Omit<Union,...>>`
     TERNYATA JUGA didistribusikan TypeScript ke tiap anggota union
     (bukan cuma `Partial<Union>` polos), PELAJARAN dicatat di komentar
     `use-draft-state.ts`.

3. **Jalur data FUND_TRANSFER dibangun TERPISAH dari `computeCashflowSync`**
   — user EKSPLISIT minta ini setelah didiskusikan risikonya ("kalau
   dibuat jalur agregasi transfer begitu, agregasi ini akan kompleks
   juga tidak ya?"): menambah `sourceType` spesial ke
   `aggregate-by-date-account-and-source-type.ts` akan menjalar ke 3
   pemanggil `computeCashflowSync` (`sync-cashflow.ts` insert,
   `use-preview-sync.ts`, `use-load-mapping-keys.ts`) — TERBUKTI dari
   pembacaan kode nyata, BUKAN asumsi. Solusi: "jalur mapping ambil
   fungsi khusus sendiri":
   - `shared/retailku/mcp-tools/get-fund-transfer-list.ts` (BARU) —
     wrapper `get_fund_transfer_list`, DIVERIFIKASI ke data nyata Warung
     Aqil (7 transfer POSTED, `TRF-260926-01` dkk). Bentuk respons BEDA
     dari `get_cashflow_detail` (`{data,total,page,limit}` langsung,
     BUKAN `{data,meta:{pagination}}`).
   - `shared/sync/cashflow/helpers/fetch-all-transfer-list-items.ts`
     (BARU) — loop pagination, kondisi berhenti `page*limit >= total`
     (beda dari `fetch-all-cashflow-detail-rows.ts` yg pakai
     `totalPages`).
   - `shared/sync/cashflow/helpers/extract-transfer-rows.ts` (BARU) —
     fungsi MURNI sinkron (pola sama `extractArApRows`, TIDAK panggil
     MCP sendiri), hasilkan `TransferRow[]`.
   - `contents/mapping/context/hooks/use-load-transfer-mapping-keys.ts`
     (BARU) — SEJAJAR `useLoadMappingKeys` (generic), TAPI connect+fetch+close
     MCP sendiri, TIDAK lewat `computeCashflowSync` sama sekali.
   - `computeCashflowSync`/`CashflowSyncPlan`/`sync-cashflow.ts`/
     `use-preview-sync.ts` **TIDAK DISENTUH SAMA SEKALI** sesi ini —
     insert transfer sungguhan TETAP belum ada, sengaja ditunda ke sesi
     berikutnya (lihat "Lanjut sesi berikutnya").

4. **BUG DITEMUKAN & DIPERBAIKI sesi ini — bentuk `key` transfer SALAH
   di iterasi pertama**: awalnya `key = transfer:${item.number}`
   (mis. `transfer:TRF-260926-01`) — SALAH karena itu identitas
   TRANSAKSI INDIVIDUAL, bukan identitas JENIS pergerakan seperti
   aturan yg SUDAH berlaku di key generic (`detail:<accountId>:<sourceType>:<arah>`,
   lihat `docs/todos/plan/retailku-sync-field-mapping.md` "Bentuk key").
   Akibat nyata TERLIHAT LANGSUNG di UI: tiap transfer baru = key baru
   = user harus mapping ULANG tiap transaksi (kontradiksi total dgn
   tujuan mapping "atur sekali, berlaku selamanya"), DAN
   `formatMappingKeyLabel` gagal parse (hasil label "undefined" di UI).
   **DIPERBAIKI**: `key = transfer:${fromAccount.id}:${toAccount.id}`
   (UUID PASANGAN akun Retailku, BUKAN nomor dokumen) — SATU key
   berlaku utk SEMUA transfer dgn pasangan akun sama, TERVERIFIKASI ke
   DB nyata (lihat poin 7). Field `transferNumber` (representasi 1
   transaksi) diganti `transactionCount` (jumlah transaksi yg berbagi
   key ini, MURNI tampilan, tidak masuk `key`).

5. **Toggle "Mengikuti Retailku" (BARU, note+description) — DITAMBAH KE
   KEDUA VARIAN, bukan cuma transfer**: awalnya cuma dipikirkan utk
   transfer (user tanya "note dan description ini bisa ambil otomatis
   dari retailku?"), TAPI DIPERLUAS ke generic SETELAH user tanya
   spesifik soal OPERATIONAL_EXPENSE minggu itu — DIVERIFIKASI ke data
   nyata Warung Aqil (`get_operational_expense_list`, Sept 2026): 4
   transaksi, key `detail:<akun>:OPERATIONAL_EXPENSE:outflow` YANG SAMA
   MENGGABUNGKAN "Server Retailku"/Beban Operasional (Rp88.800) DAN
   "Amal"/Beban Amal dan Zakat (Rp2.000+Rp4.000) DAN "Upah Adel"/Beban
   Operasional (Rp100.000) — note/description statis 1 nilai utk
   SEMUANYA jelas kehilangan detail "beban ini utk apa". KESIMPULAN:
   masalah SAMA persis dgn transfer (1 key = berpotensi banyak
   transaksi), solusi SAMA:
   - `GenericMappingRowDraft`/`TransferMappingRowDraft` — tambah
     `noteFollowSource: boolean` + `descriptionFollowSource: boolean`.
   - Disimpan ke kolom BARU `extra_fields` (migrasi 0024, JSON nullable)
     + `source_kind` (migrasi 0024, TEXT NOT NULL DEFAULT 'generic') —
     **KEPUTUSAN ARSITEKTUR PENTING**: dipilih JSON drpd kolom boolean
     eksplisit SETELAH riset eksplisit (Explore agent) soal jalur AR/AP
     — ditemukan AR/AP 100% otomatis (note/kontak hardcoded, TIDAK ada
     mapping user sama sekali) TAPI dokumen rancangan lama
     (`retailku-dynamic-sourcetype-mapping.md`) SUDAH mengusulkan key
     `ar_ap:<direction>:<sourceType>` masuk ke tabel mapping yang sama
     — kesimpulan: makin banyak `sourceType` spesial direncanakan
     (consignment, provider-payout, AR/AP), kolom boolean/eksplisit
     akan TERUS MENUMPUK tiap kebutuhan baru, JSON lebih tahan lama.
     `source_kind` ditambah SEKALIAN (bukan cuma `extra_fields`) supaya
     klasifikasi baris jadi DATA eksplisit, bukan hasil PARSING STRING
     key (sumber bug poin 4 di atas) — user SETUJU eksplisit ("Ya —
     catat sbg bagian arsitektur extra_fields nanti" lalu "ini akan
     diimplementasikan sekarang" saat ditanya ulang).
   - `FollowSourceToggle` (shared component, `form/follow-source-toggle.tsx`)
     — Switch RHF, field text/rich-text terkait DISABLED saat toggle
     ON, placeholder "(ikut deskripsi tiap transaksi Retailku)", nilai
     statis lama TETAP tersimpan (tidak dihapus, fallback kalau toggle
     dimatikan lagi).
   - **Teks penjelas ditambahkan** (permintaan terakhir sesi): muncul
     HANYA saat toggle ON, di bawah label — "Kalau key ini mewakili
     lebih dari 1 transaksi Retailku, hasilnya berupa daftar rincian
     tiap transaksi — bukan cuma satu nilai." MURNI teks statis
     (user EKSPLISIT tolak pendekatan hitung `transactionCount` utk
     generic: "kok perlu transactionCount? Bukankah cukup teks saja?
     Karena memang hanya informasi, tidak ada efek apa apa ke mapping").

6. **Form fund-transfer DISATUKAN PENUH ke pola generic (dari PoC ke
   PRODUKSI)** — atas permintaan eksplisit "coba lanjut eksekusi sampai
   tersimpan di db dan hapus pocnya":
   - `useFundTransferMappingForm` ditulis ulang total: dari
     `handleSubmit`+`console.log` (tombol submit sendiri) jadi
     live-sync `useWatch`→`onChange` (PERSIS pola `useGenericMappingForm`).
   - `FundTransferMappingForm` — `<form onSubmit>`+`Button` submit
     sendiri DIHAPUS, terima `onChange` prop dari `FlexRenderForm`.
   - `schema.ts` fund-transfer DISEDERHANAKAN dari
     `z.discriminatedUnion("sourceType",[...])` (1 varian) jadi flat
     object biasa — union Zod TIDAK PERLU lagi krn switch varian sudah
     ditangani `FlexRenderForm` di level React (bukan level Zod).
   - `use-mapping-draft-save.ts` — `transferPayload` DIGABUNG ke
     `payload` yang SAMA dgn `genericPayload` (SATU array, SATU
     `saveMapping.mutate(...)` call) — `console.log`+`toast.info`
     DIHAPUS, diganti `saveMapping.mutate(payload, { onSuccess: () =>
     setDrafts({}) })` SUNGGUHAN.
   - `useFieldMapping`/`useSaveFieldMapping`/`FieldMapping`/
     `SaveFieldMappingInput` (`use-field-mapping.ts`) DIPERLUAS baca+tulis
     `source_kind`+`secondary_account_id`+`extra_fields` (SEBELUMNYA
     cuma baca `secondary_account_id`, migrasi 0023, di sesi yg SAMA
     sebelum toggle ditambah).

7. **DIVERIFIKASI ke `finance.dev.db` NYATA (ikuti
   `docs/rules/checking-dev-database.md` PERSIS)** setelah user test
   manual di UI (isi form transfer + toggle, klik "Simpan Mapping"):
   - DB+WAL+SHM di-copy ke scratchpad (WAL timestamp LEBIH BARU dari
     `.db` utama, sesuai peringatan rule).
   - Migrasi 24 `success=1`, sampai versi terbaru.
   - Baris transfer nyata (id 10): `key =
     transfer:d254e605-...:b9179630-...` (PASANGAN UUID akun, BUKAN
     nomor dokumen — konfirmasi bug poin 4 SUDAH benar), `source_kind =
     FUND_TRANSFER`, `local_account_id=8`/`secondary_account_id=6`
     (2 akun TERPISAH tersimpan benar), `extra_fields =
     {"noteFollowSource":true,"descriptionFollowSource":true}`.
   - Baris generic (id 5, `detail:...SALE:inflow`) `updated_at` SAMA
     PERSIS dgn baris transfer (`2026-09-27 22:21:45`) — BUKTI KUAT
     `saveMapping.mutate` jalan SATU BATCH gabungan generic+transfer,
     sesuai desain "1 tombol, 1 payload".
   - FK ditelusuri: `local_account_id`/`secondary_account_id`/
     `category_id` SEMUA merujuk akun/kategori aktif yg valid (BUKAN
     ID hantu).

8. **Dikonfirmasi TIDAK ADA GAP antara mode "Ringkasan" (summary) dan
   "Detail"** (pertanyaan terakhir sesi) — `useLoadMappingKeys`,
   `use-mapping-candidates.ts`, `genericMappingSchema`,
   `FollowSourceToggle` SEMUA mode-agnostic (`mode` cuma dipakai utk
   filter prefix key `saved.key.startsWith(mode+":")`, bukan behavior
   berbeda). Diverifikasi ke DB nyata: baris `summary:*` (id 1-4) ADA,
   struktur kolom IDENTIK dgn baris `detail:*`, siap dipakai `extra_fields`
   tanpa migrasi tambahan. Perbedaan granularitas summary vs detail itu
   DISENGAJA (tujuan kedua mode), BUKAN gap yg perlu diperbaiki.

## PERCOBAAN YANG DI-REVERT sesi ini (penting, jangan diulang tanpa
## diskusi ulang)

Sempat MULAI mengerjakan jalur BACA `extra_fields` saat sync (supaya
toggle "Mengikuti Retailku" benar2 berefek ke insert) — user
menginterupsi: **"Revert dulu perubahannya. Kita tadi bahas dari sisi
mapping. Bukan sync"**. 4 file DI-REVERT via `git checkout --`:
- `shared/sync/cashflow/types.ts` (field `sourceDetails` di
  `AggregatedTotal`, field `noteFollowSource`/`descriptionFollowSource`
  di `RetailkuSyncFieldMappingRow`)
- `shared/sync/cashflow/helpers/aggregate/aggregate-by-date-account-and-source-type.ts`
  (kumpulkan `sourceDetails` saat agregasi)
- `shared/sync/cashflow/helpers/aggregate/aggregate-by-date-and-account.ts`
  (sama, mode summary)
- `shared/sync/cashflow/helpers/load-sync-inputs/load-field-mapping.ts`
  (baca `extra_fields`, parse jadi boolean)

**IDE yang SEMPAT dibahas (belum diimplementasikan, TAPI user pikirkan
serius utk sesi depan)**: kalau ada BANYAK transaksi 1 hari
(mis. 3 OPERATIONAL_EXPENSE), JANGAN pecah jadi banyak baris insert
(itu akan mengubah idempotency/`sourceRef` yg sudah stabil, scope
BESAR) — CUKUP `description`-nya jadi DAFTAR RINCIAN (Tiptap bullet
list, mis. "Server: Rp 88.800", "Upah Adel: Rp 100.000") sementara
`net`/jumlah baris insert TETAP 1 SEPERTI SEKARANG. Ini butuh
`AggregatedTotal` bawa `sourceDetails: {description,amount}[]` (baris
mentah SEBELUM digabung net), lalu `resolveMappedTotal` (plan-rows)
bangun Tiptap doc dari situ kalau `descriptionFollowSource` aktif.
BELUM diputuskan final, BELUM ada kode — CUMA ide yg tercatat sini
supaya tidak hilang.

## Status kode saat ini (PENTING, baca sebelum lanjut apa pun)

- **`DRY_RUN = true` MASIH AKTIF** di `sync-cashflow.ts` — TIDAK
  disentuh sesi ini sama sekali (scope EKSPLISIT dibatasi user 2x:
  "cuma simpan MAPPING" saat ditanya, dan revert di atas).
- **Tombol "Simpan Mapping" SEKARANG SUNGGUHAN menulis ke DB** —
  `saveMapping.mutate(...)` aktif, BUKAN lagi `console.log`. Ini
  BERBEDA dari status akhir sesi 27 Sept (waktu itu MASIH DRY_RUN utk
  simpan mapping juga) — PERUBAHAN status penting, JANGAN kira masih
  PoC.
- **Form FUND_TRANSFER SEKARANG TERINTEGRASI PENUH ke tab Mapping**
  (dipilih otomatis oleh `FlexRenderForm` saat key `sourceType:
  FUND_TRANSFER` muncul) — BUKAN lagi komponen berdiri sendiri yg
  belum di-mount. Folder `fund-transfer-poc/` SUDAH TIDAK ADA.
- **Insert transaksi transfer SUNGGUHAN (ke tabel `transactions`)
  BELUM ADA SAMA SEKALI** — mapping-nya siap (akun 2 sisi tersimpan),
  TAPI tidak ada `buildTransferPlanRows`/pemanggilan di
  `sync-cashflow.ts` yg memakainya. Sync sekarang MASIH memperlakukan
  FUND_TRANSFER sebagai 2 baris cashflow generic terpisah (income+expense),
  SAMA PERSIS seperti sebelum sesi ini — cuma MAPPING-nya yg sudah siap,
  BUKAN insert-nya.
- **Toggle "Mengikuti Retailku" TERSIMPAN tapi TIDAK BEREFEK ke sync**
  — lihat "PERCOBAAN YANG DI-REVERT" di atas. User SADAR PENUH soal
  ini (ditanya eksplisit "jadi sekarang jika ada beban operasional, ini
  akan mengikuti Retailku ya?" — dijawab BELUM, dikonfirmasi user
  paham).
- Kolom `retailku_account_id`/`retailku_account_code`/`retailku_account_name`
  utk baris `source_kind: FUND_TRANSFER` diisi APA ADANYA dari akun
  ASAL (`fromAccountId`) sbg representasi, `retailkuAccountName`
  dibuat deskriptif "Dari → Ke" — DICATAT DI KOMENTAR
  `use-mapping-draft-save.ts` sbg BUKAN solusi final, cuma tambalan
  krn 3 kolom itu dirancang utk 1 akun (NOT NULL di skema).

## Dokumen yang berubah/baru sesi ini

- Migrasi `0023_retailku_sync_field_mapping_secondary_account.sql`,
  `0024_retailku_sync_field_mapping_extra_fields.sql` — BARU, +
  registrasi di `migrations.rs` (versi 23, 24).
- TIDAK ADA perubahan ke `docs/reference/` atau `docs/todos/plan/`
  sesi ini — SEMUA pekerjaan sesi ini di level KODE (migrasi+TS+TSX),
  bukan dokumen rancangan. `docs/todos/plan/retailku-dynamic-sourcetype-mapping.md`
  Keputusan terbuka #2 SUDAH TERJAWAB oleh kerja sesi ini (belum
  diupdate FILE-nya — PERTIMBANGKAN update dokumen itu di sesi
  berikutnya kalau sempat, supaya tidak lagi tercatat "belum
  diputuskan" padahal sudah).

## Keputusan yang SUDAH diambil sesi ini (jangan tanya ulang)

1. Skema kolom key >1 akun: `secondary_account_id` (migrasi 0023),
   BUKAN tabel baru/JSON generik utk KEBUTUHAN INI SPESIFIK.
2. `source_kind` + `extra_fields` (migrasi 0024) sbg mekanisme UMUM
   lintas sourceType spesial (transfer SEKARANG, AR/AP/consignment/
   provider-payout MUNGKIN nanti) — JSON dipilih drpd kolom boolean
   eksplisit KARENA makin banyak sourceType spesial direncanakan.
3. Struktur folder `contents/mapping/form/`: 1 folder PER VARIAN
   (`generic/`, `fund-transfer/`), MENGIKUTI preseden
   `transactions/form/add-edit/` — BUKAN dikelompokkan per jenis file
   (schema/hooks/components terpisah).
4. `FlexRenderForm` (`form/index.tsx`) jadi TITIK SWITCH varian di
   level REACT — Zod `discriminatedUnion` lintas sourceType TIDAK
   DIPAKAI LAGI (disederhanakan jadi flat schema per form, SAMA pola
   generic).
5. Toggle "Mengikuti Retailku" (note+description) RELEVAN utk KEDUA
   varian (generic DAN transfer) — BUKAN cuma transfer, TERBUKTI dari
   data nyata OPERATIONAL_EXPENSE.
6. `key` transfer = `transfer:<fromAccountId>:<toAccountId>` (PASANGAN
   UUID akun), BUKAN `transfer:<nomorDokumen>` — INI KOREKSI BUG,
   JANGAN diulang.
7. Form fund-transfer & tombol Simpan Mapping SEKARANG PRODUKSI PENUH
   (bukan PoC) — submit sungguhan ke DB, TERVERIFIKASI.
8. Jalur BACA `extra_fields` saat sync (agregasi/insert) SENGAJA
   DI-REVERT dari sesi ini — TETAP di luar scope, TAPI idenya
   ("description jadi daftar rincian, BUKAN pecah baris insert")
   tercatat sbg arah yg masuk akal utk dibahas lagi.
9. TIDAK ADA gap fungsional mode summary vs detail — perbedaan
   granularitas keduanya DISENGAJA, bukan bug.

## Lanjut sesi berikutnya (EKSPLISIT diminta jadi FOKUS UTAMA: "jalur sync")

User eksplisit (saat ditanya prioritas): **"Secara garis besar, jalur
sync ya?"** — mencakup KEDUA hal berikut, urutan BELUM diputuskan mana
duluan:

1. **Jalur insert transfer sungguhan** — `buildTransferPlanRows`
   (pola sama `ar-ap-plan-rows/`) yg baca `secondary_account_id` dari
   `retailku_sync_field_mapping` (via `loadFieldMapping`, PERLU
   diperluas baca `secondary_account_id` juga — SAAT INI
   `load-field-mapping.ts` yg dipakai `shared/sync/` BELUM baca kolom
   itu SAMA SEKALI, beda dari `use-field-mapping.ts` sisi UI yg SUDAH),
   hasilkan rencana insert transaksi tipe `transfer` TUNGGAL (bukan 2
   baris income/expense terpisah spt SEKARANG). Masuk ke
   `CashflowSyncPlan` sbg field baru (SEJAJAR `arApRows`), disambungkan
   ke `sync-cashflow.ts` (loop insert BARU, TETAP `DRY_RUN` dulu utk
   verifikasi manual sebelum dinyalakan sungguhan — pola SAMA yg
   sudah ada utk AR/AP).
2. **Jalur baca `extraFields`/toggle "Mengikuti Retailku" saat sync**
   — lihat "PERCOBAAN YANG DI-REVERT" & "IDE yang sempat dibahas" di
   atas: `AggregatedTotal` bawa `sourceDetails` (baris mentah sebelum
   digabung net), `resolveMappedTotal` bangun Tiptap list dari situ
   kalau toggle aktif — `net`/jumlah baris insert TETAP 1 (TIDAK pecah
   jadi banyak baris), CUMA `description`-nya yg berupa rincian.
   `load-field-mapping.ts` (`shared/sync/`) PERLU baca `extra_fields`
   juga (BELUM, lihat poin 1).

**PENTING sebelum mulai**: dua pekerjaan ini SALING BERSINGGUNGAN di
`load-field-mapping.ts` (keduanya butuh field yg SAMA SEKALI belum
dibaca fungsi itu: `secondary_account_id` DAN `extra_fields`) —
PERTIMBANGKAN kerjakan SEKALIGUS drpd bolak-balik ubah file yg sama 2x.
`RetailkuSyncFieldMappingRow` (types.ts) JUGA perlu diperluas utk
KEDUANYA sekaligus kalau begitu.

## Catatan proses (feedback untuk sesi berikutnya)

- User BERULANG KALI menghentikan asisten yang mulai melebar dari
  scope yg sedang dibahas — 2 kejadian JELAS sesi ini: (1) diminta
  eksplisit "cuma simpan MAPPING" saat asisten hendak sekalian
  menyalakan `DRY_RUN=false`; (2) diminta REVERT eksplisit saat asisten
  mulai mengerjakan jalur BACA `extra_fields` di `shared/sync/` padahal
  pertanyaan awalnya soal MAPPING. **Pola: SELALU tanya/konfirmasi
  scope dulu sebelum menyentuh file DI LUAR area yg sedang didiskusikan,
  JANGAN asumsikan "sekalian saja" itu diinginkan** — bahkan kalau
  perubahannya terasa "logis mengikuti alur", user lebih suka scope
  kerja dijaga ketat sesuai apa yg SEDANG dibahas.
- User AKTIF menguji asumsi asisten dgn data NYATA sebelum menerima
  klaim — 2 kejadian: (1) minta cek `get_operational_expense_list`
  nyata sebelum setuju toggle relevan utk generic (BUKAN cuma percaya
  penjelasan konseptual); (2) tanya "ada aturan penulisan key tidak?"
  yg berujung menemukan BUG key transfer SALAH format, sebelum asisten
  sempat menyimpulkan sendiri. **Pola: verifikasi ke data/dokumen
  ASLI SEBELUM mengklaim sesuatu "benar"/"cukup", user akan menguji
  balik kalau asisten melompat ke kesimpulan.**
- User TOLAK solusi yg overengineered relatif thd kebutuhan — kejadian
  jelas: asisten mengusulkan `transactionCount` (hitung ulang dari
  `computeCashflowSync`) utk generic supaya teks penjelas toggle bisa
  sebut angka pasti, user LANGSUNG tolak ("kok perlu transactionCount?
  Bukankah cukup teks saja? Karena memang hanya informasi, tidak ada
  efek apa apa ke mapping") — PILIH solusi PALING SEDERHANA yg
  memenuhi kebutuhan, JANGAN tambah kompleksitas "supaya lebih akurat"
  kalau akurasi itu TIDAK DIMINTA.
- User SUKA verifikasi ke database dev SUNGGUHAN, BUKAN cuma percaya
  toast UI — konsisten dgn `docs/rules/checking-dev-database.md`,
  DIKONFIRMASI lagi sesi ini (minta cek DB PERSIS ikuti rule itu utk
  baris transfer DAN generic).
