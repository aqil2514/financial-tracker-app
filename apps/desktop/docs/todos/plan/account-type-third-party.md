# Tipe Akun Dana Pihak Ketiga

## Status & TODO saat ini (ringkas)

Penjelasan tiap poin ada di bagian "Detail & rasional keputusan" paling bawah — lihat juga model data & aturan lengkap di [docs/concept/konsep-dana-pihak-ketiga.md](../../../../../docs/concept/konsep-dana-pihak-ketiga.md), BACA DULU sebelum menulis kode apa pun di sini.

### Konsep & skema

- [x] Diskusi konsep selesai (2026-10-09)
- [x] Bentuk tabel detail diputuskan (2026-10-13) — tabel baru `third_party_funds`
- [x] Tidak perlu kolom `status` (2026-10-13) — sisa titipan dihitung ulang dari SUM
- [x] Validasi oversell diputuskan perlu (2026-10-13) — logic-nya belum ditulis
- [x] Migrasi skema ditulis & diverifikasi (2026-10-13) — `0049_account_type_third_party.sql`
- [x] Penempatan UI/halaman diputuskan (2026-10-13) — halaman terpisah `/third-party`, 3 tab
- [x] Dialog state (tab Akun & Data) pakai `createDialogQueryContext` (URL-backed)

### Logic transaksi (blocker CRUD kedua tab di bawah)

- [ ] `classifyAccountPair` — belum tambah kombinasi `third_party-*`
- [ ] `applyThirdPartyTransaction` — belum ditulis (termasuk validasi oversell)
- [ ] Form transfer `third_party → third_party` — belum didesain
- [ ] Pengecualian cashflow (`WHERE account_type != 'third_party'`) — belum diimplementasikan

### Tab Ringkasan

- [ ] Breakdown per kontak × akun — masih placeholder, bergantung tab Data (Read)

### Tab Akun (CRUD akun `third_party`)

- [x] Create — trigger + dialog create akun jalan (reuse `AccountForm`/`useCreateAccount`)
- [ ] Read — daftar akun `third_party` beserta saldo — masih placeholder
- [ ] Update — edit akun `third_party` (reuse `AccountForm`/`useUpdateAccount`, belum disambung di tab ini)
- [ ] Delete — belum didesain untuk tab ini

### Tab Data (CRUD baris `third_party_funds`)

- [x] Create — form "Catat Titip/Ambil" didesain & di-render — submit masih `console.log`
- [ ] Create — sambungkan submit ke mutation nyata (bergantung `applyThirdPartyTransaction`)
- [ ] Read — daftar/riwayat titip-ambil — masih placeholder
- [ ] Update — edit baris titip-ambil — belum didesain
- [ ] Delete — hapus baris titip-ambil — belum didesain

### Lain-lain

- [x] Badge/indikator di `AccountCard` halaman Akun — TIDAK perlu kode tambahan, sudah otomatis dapat badge tipe akun lewat `ACCOUNT_TYPE_OPTIONS` generik (diverifikasi 2026-10-13)
- [ ] Sinkronisasi ke `apps/worker`/`apps/mcp-server` — belum dibahas

## Latar belakang

Dipicu oleh kebutuhan nyata: user (Aqil) sudah menyimpan dana titipan orang lain, saat ini "terbantu" oleh fitur pisah kantong Bank Jago sebagai workaround manual — tapi di financial-app sendiri, akun yang dipakai ("Kantong Utama (Jago)") masih bertipe `cash` biasa, belum ada pemisahan terstruktur. Artinya total kekayaan pribadi di dashboard/laporan saat ini tercampur dengan saldo yang bukan benar-benar milik Aqil.

`docs/concept/konsep-tipe-akun.md` (ditulis lebih dulu) sudah menyebut "Dana Pihak Ketiga" sebagai salah satu tipe akun yang akan menyusul, dengan konteks awal dari kebutuhan sync Retailku (`CASH_OPNAME.thirdPartyFunds`) — tapi `CASH_OPNAME` dari Retailku sendiri sudah FINAL sebagai `generic` (dana titipan toko sengaja tidak pernah dijurnal Retailku, lihat `docs/reference/retailku-cashflow-row-classification.md`). Fitur ini di financial-app MURNI kebutuhan pencatatan pribadi, terpisah dari sync Retailku.

## Kenapa modelnya SEPERTI INI (ringkasan keputusan, detail di dokumen konsep)

Diskusi menguji dan MENOLAK beberapa alternatif sebelum sampai ke model final:

1. **DITOLAK: atribut/flag di transaksi akun `cash` yang sudah ada** (bukan akun terpisah) — melanggar prinsip "satu akun satu tipe murni" di `konsep-tipe-akun.md`, balik mencampur saldo titipan dengan saldo pribadi di akun yang sama.
2. **DITOLAK: satu akun virtual per kombinasi tempat×pihak** (mis. "Kas Tunai-Adel", "Bank Jago-Adel") — meledak jumlah akun tiap ada penitip baru, menyimpang dari pola `debt` yang justru tidak butuh akun per kontak.
3. **DITOLAK: satu akun global menampung semua titipan lintas tempat** — kehilangan breakdown per-tempat yang dikonfirmasi sebagai kebutuhan nyata ("titipan Adel di Kas Tunai berapa, di Bank Jago berapa").
4. **DIPILIH: satu akun virtual `third_party` PER TEMPAT FISIK** (grup/lokasi) — "Kas Orang Lain [Tunai]", "Kas Orang Lain [Bank Jago]", dst. Banyak pihak dibedakan via `contact_id` di level data DALAM satu akun, mirror persis pola `debt`/`contacts`.

Lalu diuji arah pergerakan mana yang valid sebagai `transfer` vs harus `income`/`expense` terpisah — hasilnya: `third_party ↔ cash` TIDAK PERNAH transfer (diuji lewat beberapa skenario: ambil+upah, hibah/pindah-kepemilikan-ke-Aqil — keduanya tetap dua transaksi independen, bukan satu transfer), sementara `third_party → third_party` (pindah tempat dan/atau pindah kepemilikan antar pihak) VALID sebagai transfer dengan kontak sisi keluar/masuk independen. Detail lengkap tiap skenario yang diuji ada di dokumen konsep, bagian "Tiga jenis pergerakan".

## Perbandingan dengan pola yang sudah ada (buat orientasi implementasi nanti)

| Aspek | `debt` (sudah ada) | `third_party` (rencana) |
|---|---|---|
| Trigger utama | `transfer` (cash↔debt) | `income`/`expense` SATU SISI (seperti investasi `record_mode: direct`) |
| Transfer antar akun sama tipe | `debt-debt` diklasifikasi tapi NO-OP (tidak diimplementasikan) | `third_party-third_party` HARUS diimplementasikan sungguhan (pindah tempat/kepemilikan) |
| Ambiguitas arah | `debt-cash` ambigu, butuh `debtAction` eksplisit dari user | Tidak ambigu — `income`=nitip, `expense`=ambil, jelas dari jenis transaksinya sendiri |
| Masuk cashflow? | Ya (transfer tidak masuk cashflow dari awal, tapi debt TIDAK py pengecualian khusus income/expense) | TIDAK — pengecualian baru berdasar `account_type`, preseden pertama di app ini |
| Satu akun per kontak? | Tidak — kontak dibedakan di `debts.contact_id` | Tidak — sama, kontak dibedakan di level data, bukan akun |

## Pekerjaan yang MASIH KOSONG

Urutan kerja yang disarankan:

1. ~~Putuskan 3 pertanyaan terbuka di dokumen konsep~~ — SELESAI (2026-10-13).
2. ~~Migrasi skema (`account_type` + tabel detail)~~ — SELESAI (2026-10-13), lihat `0049_account_type_third_party.sql`.
3. ~~UI/halaman~~ — SELESAI (2026-10-13): halaman `/third-party`, 3 tab (Ringkasan/Akun/Data) via `BaseTabsUrl`, dialog create akun & create data sudah ter-render. SISA di bagian ini: badge di `AccountCard` halaman Akun (kemungkinan tidak perlu, lihat poin di atas).
4. `classifyAccountPair` (tambah kombinasi `third_party-*`) dan `applyThirdPartyTransaction` (termasuk validasi oversell) — BELUM ditulis, blocker untuk poin 5.
5. Sambungkan submit form "Catat Titip/Ambil" ke mutation nyata (bergantung poin 4) — form & schema-nya sudah ada, tinggal wiring.
6. Daftar/konten tiap tab: riwayat titip-ambil (tab Data), daftar akun `third_party` (tab Akun), breakdown per kontak×akun (tab Ringkasan, bergantung poin 5).
7. Form transfer `third_party → third_party` (pindah tempat/kepemilikan).
8. Pengecualian cashflow — audit SEMUA tempat yang query cashflow (bukan cuma satu file) sebelum menganggap selesai.
9. Worker/MCP sync — baru dipikirkan setelah desktop solid, mengikuti preseden investasi yang sempat desktop-only dulu.

## Detail & rasional keputusan

Penjelasan lengkap tiap poin checklist di atas, urut sesuai urutan checklist.

**Bentuk tabel detail** — TIDAK 1:1 copy dari `debts`. Tabel baru `third_party_funds` (`account_id`, `contact_id` NOT NULL, `transaction_id`, `direction` IN ('in','out'), `amount`, `date`, `note`). `contact_id` NOT NULL + `ON DELETE RESTRICT` (beda dari `debts.contact_id` yang nullable/`SET NULL`) karena konsep mewajibkan kontak terisi. Kolom `direction` (bukan `type` seperti `debts.type`) karena transfer `third_party→third_party` butuh DUA baris independen per transaksi (satu `out` di kontak+akun asal, satu `in` di kontak+akun tujuan) — tidak bisa hanya mengandalkan `transactions.type`.

**Tidak perlu kolom `status`** — sisa titipan dihitung ulang dari `SUM(amount WHERE direction='in') - SUM(amount WHERE direction='out')` per `(account_id, contact_id)`.

**Validasi oversell** — sebelum insert baris `direction='out'`, hitung sisa titipan via query SUM di atas, tolak kalau `amount` yang diambil > sisa. Pola serupa `getRemainingUnit()` di investasi. Belum diimplementasikan di kode (baru keputusan desain), logic-nya menyusul di `applyThirdPartyTransaction`.

**Migrasi skema** — [0049_account_type_third_party.sql](../../../src-tauri/migrations/0049_account_type_third_party.sql) — `accounts.account_type` tambah `'third_party'` (copy-and-rename, ikut rebuild 8 tabel yang FK ke `accounts` baik langsung maupun transitif lewat `transactions`: `transactions`, `transaction_attachments`, `transaction_labels`, `debts`, `debt_payments`, `retailku_sync_field_mapping`, `investment_accounts`, `investment_purchases`, `investment_sales`, `account_labels`) + tabel baru `third_party_funds`. Sudah diverifikasi eksekusi penuh (seed data + jalankan migrasi + cek row count & `foreign_key_check`), bukan cuma dibaca. Terdaftar di [migrations.rs](../../../src-tauri/src/migrations.rs).

**Penempatan UI/halaman** — halaman terpisah `/third-party` ("Dana Pihak Ketiga" di sidebar), BUKAN bagian dari halaman Akun. Struktur 3 tab (`content/summary`, `content/accounts`, `content/data`) via `BaseTabsUrl` (tab aktif tersimpan di URL). Lihat `apps/desktop/src/features/third-party/`.

**Dialog state** — kedua tab (`accounts`, `data`) pakai `createDialogQueryContext` (URL-backed, `provider/dialog-query-state/`) — konsisten dengan pola `features/accounts`.

**Tab "Akun"** — trigger "Tambah Akun" + dialog create SUDAH jalan — reuse penuh `AccountForm`/`useCreateAccount`/`accountSchema` dari `features/accounts` (barrel), `account_type` di-prefill `'third_party'`. Lihat `content/accounts/dialog/create.tsx`.

**Tab "Data" — form** — form "Catat Titip/Ambil" (field: direction, akun, kontak, nominal, tanggal, catatan) SUDAH didesain & di-render — `content/data/form/schemas/` (Zod schema + default values), `content/data/form/index.tsx`. Submit MASIH `console.log`, BELUM disambung ke mutation nyata.

**`classifyAccountPair`** — belum ditambah kombinasi `third_party-*` — PENTING: `third_party-third_party` BUKAN reuse dari `debt-debt` yang sudah ada (itu ternyata no-op, lihat dokumen konsep bagian "Pindah tempat dan/atau pindah kepemilikan") — perlu logic baru sungguhan.

**`applyThirdPartyTransaction`** — belum ditulis — PERHATIAN: pola utamanya `income`/`expense` SATU SISI (seperti investasi `record_mode: direct`), BUKAN trigger dari `transfer` seperti `applyDebtTransaction`. Transfer cuma relevan untuk `third_party → third_party`. Termasuk validasi oversell.

**Tab "Data" — mutation** — sambungkan submit form ke mutation nyata (`use-create-third-party-fund.ts` atau serupa): insert ke `third_party_funds` + `transactions`, validasi oversell untuk `direction: "out"`. Bergantung pada `applyThirdPartyTransaction`.

**Tab "Data" — daftar/riwayat** — belum ada (masih placeholder "Segera Hadir" di `content/data/index.tsx`) — tabel/list baris `third_party_funds`, kemungkinan per kontak atau per akun.

**Tab "Akun" — daftar akun** — belum ada (masih placeholder "Segera Hadir" di `content/accounts/index.tsx`) — list akun bertipe `third_party` beserta saldo masing-masing (mirip `AccountsSummarySection`/`AccountsDetailSection` di `features/accounts`).

**Tab "Ringkasan"** — masih placeholder penuh (`content/summary/index.tsx`) — belum ada breakdown "siapa titip berapa di mana" per kontak × akun. Bergantung pada data `third_party_funds` nyata (tunggu mutation jalan dulu).

**Form transfer `third_party → third_party`** — belum didesain — butuh DUA field kontak independen (asal, tujuan), bukan satu kontak dipakai bersama.

**Pengecualian cashflow** (`WHERE account_type != 'third_party'`) — belum diimplementasikan — cek semua tempat yang query cashflow, bukan cuma `use-cashflow-summary.ts` (lihat daftar luas file yang menyinggung cashflow di `apps/desktop/src/features/reports/` dan `apps/desktop/src/features/retailku/`).

**Badge/indikator di `AccountCard`** (lihat [account-card.tsx](../../../src/features/accounts/contents/detail/content/account-card.tsx)) — DIKONFIRMASI (2026-10-13) tidak perlu kode tambahan. `AccountCard` sudah render badge tipe akun secara generik lewat `ACCOUNT_TYPE_OPTIONS` untuk SEMUA `account_type` (baris `accountTypeOption && <Badge ...>`), dan `'third_party'` sudah terdaftar di situ sejak migrasi `lib/account-types.ts` (label "Dana Pihak Ketiga", badge amber) — otomatis ikut tampil tanpa perlu logic khusus. Dugaan awal diskusi yang sempat mengira titipan tercampur di akun cash biasa juga tidak relevan lagi — saldo sudah terpisah bersih sejak dari struktur akun.

**Sinkronisasi ke `apps/worker`/`apps/mcp-server`** — belum dibahas sama sekali.
