# Periode Kategori — Index Navigasi

> Index navigasi utk SATU fitur lintas-app spesifik (Periode Kategori
> ikut sync cloud + tool MCP sejak awal, BUKAN desktop-only duluan
> seperti investasi). Lihat [`../README.md`](../README.md) utk
> penjelasan umum struktur `docs/todos/{plan,done}/` di root repo.

Index ini HANYA navigasi + checklist ringkas. Detail keputusan
desain, riset, dan progress implementasi ada di dokumen masing-masing
app — JANGAN duplikasi isi ke sini, cukup pointer.

## Status & TODO saat ini (ringkas)

Desktop: skema DB (many-to-many, lihat revisi di bawah) + form create
UI SELESAI (2026-10-11). Worker & MCP BELUM disentuh sama sekali.
Lihat dokumen per-app utk detail teknis.

- [x] Desktop — skema `category_periods`+`category_period_categories`
  (migrasi `0047`+`0048`, REVISI many-to-many di tengah jalan, lihat
  "Latar belakang" di bawah) + refactor halaman kategori jadi tab
  (Daftar/Periode) + form create periode (multi-select kategori,
  rentang tanggal) jalan penuh. List/ringkasan periode, edit/delete,
  DAN wiring push ke Worker semua MASIH BELUM. Lihat
  [`apps/desktop/docs/todos/plan/category-period.md`](../../../apps/desktop/docs/todos/plan/category-period.md).
- [ ] Worker — tabel D1 `category_periods`+`category_period_categories`
  + modul `category-periods/` (CRUD + query ringkasan on-the-fly) +
  endpoint push — BELUM DIMULAI, rencana di dokumen ini masih
  mengasumsikan skema LAMA (1 kategori per periode), perlu
  disesuaikan dgn revisi many-to-many sebelum dikerjakan. Lihat
  [`apps/worker/docs/todos/plan/category-period.md`](../../../apps/worker/docs/todos/plan/category-period.md).
- [ ] MCP server — perluasan `/sync` snapshot + tool baru (list/create/
  update/delete periode, get ringkasan periode) — BELUM DIMULAI, sama
  catatan skema basi spt Worker. Lihat
  [`apps/mcp-server/docs/todos/plan/category-period.md`](../../../apps/mcp-server/docs/todos/plan/category-period.md).
- [ ] Deploy D1 migrasi ke `--remote`/production — ditunda sampai
  modul Worker siap & diverifikasi lokal (pola sama `investment-sync.md`).

## Latar belakang

Kebutuhan (diskusi 2026-10-11): user ingin bisa menjawab pertanyaan
semacam "panen tahun kemarin keluar-masuknya berapa?" atau "kemarin
beli skin game Aspirant abis berapa?" — yaitu ringkasan transaksi
dalam rentang tanggal custom yang punya nama/makna sendiri (bukan
filter bulan/tahun kalender biasa seperti `period-picker` yang sudah
ada).

Keputusan desain inti (lihat detail lengkap di dokumen desktop):
- **Periode tersimpan sebagai entitas bernama** (bukan filter sesaat)
  — tabel `category_periods` (`id`, `name`, `start_date`, `end_date`).
- Ringkasan (total masuk/keluar/selisih + daftar transaksi) **selalu
  dihitung on-the-fly** dari tabel `transactions` yang sudah ada —
  TIDAK ada tabel ledger/history baru, TIDAK ada kolom agregat
  tersimpan.
- **BEDA dari konsep "Budget"** (`apps/desktop/docs/todos/plan/budget-feature.md`,
  belum diimplementasi) — Budget itu forward-looking (target/limit
  nominal dibandingkan aktual), Periode ini backward-looking
  (ringkasan histori yang sudah terjadi). Independen, tidak saling
  menggantikan.

**REVISI PENTING (2026-10-11, sama hari): many-to-many kategori per
periode.** Desain awal (migrasi desktop `0047`) scope-nya SATU
kategori per Periode (`category_id` tunggal). Ternyata tidak cukup:
kategori di app ini dipisah per TIPE transaksi (income/expense
terpisah) — siklus nyata spt "panen" (biaya pupuk/bibit = expense,
hasil jual = income) butuh mencakup BEBERAPA kategori lintas tipe
sekaligus dalam satu Periode, bukan cuma satu. Skema final (migrasi
desktop `0048`): tabel pivot `category_period_categories`
(many-to-many `category_periods` <-> `categories`). **Dokumen Worker
dan MCP di bawah ini BELUM disesuaikan dgn revisi ini** — keduanya
ditulis saat desain masih "1 kategori per periode", baca dokumen
desktop dulu (`category-period.md`, section "Revisi: many-to-many
kategori") sebelum mulai kerja Worker/MCP supaya tidak terlanjur
implementasi skema yang sudah basi.

## Catatan

- Proyek ini portofolio-only, tidak ada deadline/urgensi.
- Urutan kerja disarankan: selesaikan dulu list/ringkasan periode +
  edit/delete di desktop (supaya bentuk data & UX final, termasuk
  bentuk query ringkasan many-to-many yang belum pernah dicoba sama
  sekali), baru lanjut wiring Worker/MCP — pola sama
  `investment-sync.md`.
