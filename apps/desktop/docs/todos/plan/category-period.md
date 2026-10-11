# Periode Kategori (Category Period) — Desktop

> Detail implementasi sisi desktop utk fitur lintas-app "Periode
> Kategori". Index navigasi + status lintas-app ada di
> [`docs/todos/plan/category-period-sync.md`](../../../../../docs/todos/plan/category-period-sync.md)
> (root repo) — JANGAN duplikasi isi ke sana, cukup pointer status.

## Status & TODO saat ini (ringkas)

Migrasi database SELESAI (2026-10-11) — lihat bagian "Rencana
pendekatan" di bawah utk detail skema. Sisanya (query, UI, wiring
push) masih tahap rencana.

- [x] Migrasi `category_periods` (tabel baru) + registrasi di
  `migrations.rs` — `0047_category_periods.sql`, versi 47, 9 test
  Rust lulus (termasuk insert + trigger `updated_at` + `ON DELETE
  CASCADE` dari `categories`).
- [x] Kolom cloud-sync (`updated_at`/`deleted_at`/`sync_source`) di
  tabel ini dari awal — BEDA dari investasi yang baru ditambah
  belakangan (migrasi `0042`, lihat `investment-sync.md`) krn sync
  ke `apps/worker` sudah diputuskan perlu sejak awal, bukan menyusul.
- [ ] Query ringkasan (total masuk/keluar/selisih + daftar transaksi)
  berdasarkan `category_id` + rentang tanggal, dihitung on-the-fly
  (tidak ada kolom agregat tersimpan).
- [ ] Detail view/dialog kategori (BELUM ADA sama sekali saat ini) —
  prasyarat sebelum UI Periode bisa ditempelkan.
- [ ] Tab/section "Periode" di dalam detail view kategori: list
  periode + form tambah (nama + date range, reuse `period-picker`) +
  ringkasan saat satu periode dipilih.
- [ ] Wiring push ke `apps/worker` (`pushOnWrite`/`pushDeleteOnWrite`)
  di titik mutasi (create/update/delete periode).

## Latar belakang

Kebutuhan: user ingin bisa menjawab pertanyaan semacam "panen tahun
kemarin di kategori Sawah keluar-masuknya berapa?" atau "kemarin beli
skin game Aspirant abis berapa?" — yaitu ringkasan transaksi dalam
SATU kategori, dibatasi rentang tanggal custom yang punya nama/makna
sendiri (bukan filter bulan/tahun kalender biasa).

Keputusan eksplisit dari diskusi (2026-10-11):
- **Periode tersimpan sebagai entitas** (bukan filter sesaat/transient)
  — supaya punya nama ("Panen 2025") dan bisa dilihat ulang nanti,
  beda dari filter transaksi/`period-picker` yang sudah ada sekarang
  (`apps/desktop/src/components/query/period-picker/index.tsx`) yang
  sifatnya query-state murni, tidak disimpan.
- **Scope per SATU kategori** (bukan lintas kategori) — satu Periode
  dimiliki satu `category_id`. Lintas kategori (misal gabung kategori
  pupuk+benih+jual hasil jadi satu "siklus tanam") SENGAJA tidak
  didukung dulu, bisa jadi perluasan nanti kalau memang dibutuhkan,
  tapi menambah kompleksitas (perlu tabel pivot many-to-many) yang
  belum terbukti perlu.

**BEDA dari konsep "Budget" yang sudah dicatat sebelumnya**
(`budget-feature.md`, belum diimplementasi) — gampang tertukar krn
sama-sama "kategori + rentang waktu":
- **Budget** = target/limit nominal per kategori per bulan,
  forward-looking, dibandingkan ke aktual ("jangan sampai lewat
  segini").
- **Periode** (dokumen ini) = jendela waktu custom bernama,
  backward-looking, buat ringkasan histori yang SUDAH terjadi
  ("kemarin itu totalnya berapa").

Kedua konsep ini independen, tidak saling menggantikan. Nama tabel
`category_periods` dipilih sengaja beda dari kemungkinan nama tabel
Budget nanti (`budgets`/`budget_amounts`) biar tidak rancu.

## Rencana pendekatan

### Skema

Tabel baru `category_periods`, TANPA tabel ledger/history terpisah —
beda dari pola investasi (`investment_purchases`/`investment_sales`)
krn Periode tidak butuh mencatat peristiwa baru, cuma membatasi
rentang tanggal buat query transaksi yang SUDAH ada:

```sql
CREATE TABLE category_periods (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT
);
CREATE INDEX idx_category_periods_category ON category_periods(category_id);
```

Kolom `updated_at`/`deleted_at`/`sync_source` + trigger auto-refresh
`updated_at` disertakan **dari migrasi pertama** (pola 7 tabel
sync-able yang sudah ada sejak `0028`) — beda dari investasi yang
awalnya tidak punya kolom ini sama sekali lalu ditambah belakangan
di migrasi `0042` krn keputusan sync baru menyusul. Di sini keputusan
sync sudah diambil dari awal, jadi tidak perlu migrasi susulan utk
menambah kolom ini.

Ringkasan (total masuk, total keluar, selisih, daftar transaksi)
**dihitung on-the-fly** dari `transactions WHERE category_id = ?
AND date BETWEEN start_date AND end_date` saat periode dibuka —
sama prinsip dengan `accounts.balance` yang derived, bukan
didenormalisasi/disimpan ulang. Konsekuensi: transaksi baru yang
masuk ke rentang tanggal itu otomatis ikut terhitung tanpa perlu
sinkronisasi manual.

Belum ada keputusan soal validasi `end_date >= start_date` di level
DB (CHECK) vs cuma di level UI/form — perlu diputuskan saat
implementasi.

### UI

Kategori saat ini **belum punya halaman/dialog detail** (beda dari
akun yang sudah punya `features/accounts/dialogs/detail-dialog/`) —
list kategori cuma accordion+card
(`features/categories/list/category-list.tsx`). Jadi prasyarat fitur
ini: bikin dulu detail dialog/view kategori, baru tab/section
"Periode" ditempel di dalamnya.

Isi tab Periode:
- List periode yang sudah dibuat utk kategori itu.
- Form tambah periode baru — nama + input rentang tanggal, reuse
  komponen `period-picker` yang sudah ada utk bagian date-range-nya
  (custom range mode) meskipun konteks pakainya beda (bukan
  query-state filter, tapi nilai form yang disimpan).
- Saat satu periode dipilih: ringkasan (total masuk/keluar/selisih)
  + daftar transaksi dalam rentang itu.

### Cloud sync & MCP — diputuskan PERLU dari awal

Beda dari investasi (yang desktop-only duluan, sync menyusul), utk
Periode Kategori sync ke `apps/worker` + tool `apps/mcp-server`
**sudah diputuskan perlu dari awal** (2026-10-11) — supaya pertanyaan
seperti "panen tahun kemarin berapa?" bisa dijawab asisten AI, bukan
cuma dibuka manual di desktop. Konsekuensi konkret (ikut pola
`investment-sync.md` Tahap 0 — replikasi logic penuh, BUKAN sekadar
tabel mirror):

- Desktop tetap jadi sumber migrasi SQLite pertama & pemilik
  logic/UI, tapi `apps/worker` butuh tabel D1 sendiri
  (`category_periods`, skema sama + kolom LWW yang di D1 memang
  sudah standar) supaya device/klien lain (mobile belum dibangun,
  tool MCP TULIS) bisa bikin/ubah Periode tanpa lewat desktop dulu —
  prinsip "Worker = satu-satunya penulis D1 production" yang sudah
  dipegang `debts`/`transactions`/investasi.
- Query ringkasan on-the-fly (total masuk/keluar/selisih dari
  `transactions WHERE category_id=? AND date BETWEEN ...`) perlu
  versi Worker (query D1) DAN versi MCP (`sync-snapshot.ts`, port
  rumus yang sama dari snapshot `/sync` — pola persis
  `getInvestmentHolding`/`summarizeInvestments`), bukan cuma sisi
  desktop.
- Detail lintas-app (tahapan, endpoint, tool MCP) ditulis di
  dokumen masing-masing app, LIHAT index di
  [`docs/todos/plan/category-period-sync.md`](../../../../../docs/todos/plan/category-period-sync.md)
  — jangan duplikasi di sini.