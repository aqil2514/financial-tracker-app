# Periode Kategori — Index Navigasi

> Index navigasi utk SATU fitur lintas-app spesifik (Periode Kategori
> ikut sync cloud + tool MCP sejak awal, BUKAN desktop-only duluan
> seperti investasi). Lihat [`../README.md`](../README.md) utk
> penjelasan umum struktur `docs/todos/{plan,done}/` di root repo.

Index ini HANYA navigasi + checklist ringkas. Detail keputusan
desain, riset, dan progress implementasi ada di dokumen masing-masing
app — JANGAN duplikasi isi ke sini, cukup pointer.

## Status & TODO saat ini (ringkas)

Baru tahap rencana di SEMUA app — belum ada kode/migrasi ditulis di
mana pun. Lihat bagian "Latar belakang" di bawah utk ringkasan
konsep, dan dokumen per-app utk detail teknis.

- [ ] Desktop — skema `category_periods` + migrasi + UI (detail view
  kategori + tab Periode) + wiring push. Lihat
  [`apps/desktop/docs/todos/plan/category-period.md`](../../../apps/desktop/docs/todos/plan/category-period.md).
- [ ] Worker — tabel D1 `category_periods` + modul `category-periods/`
  (CRUD + query ringkasan on-the-fly) + endpoint push. Lihat
  [`apps/worker/docs/todos/plan/category-period.md`](../../../apps/worker/docs/todos/plan/category-period.md).
- [ ] MCP server — perluasan `/sync` snapshot + tool baru (list/create/
  update/delete periode, get ringkasan periode). Lihat
  [`apps/mcp-server/docs/todos/plan/category-period.md`](../../../apps/mcp-server/docs/todos/plan/category-period.md).
- [ ] Deploy D1 migrasi ke `--remote`/production — ditunda sampai
  modul Worker siap & diverifikasi lokal (pola sama `investment-sync.md`).

## Latar belakang

Kebutuhan (diskusi 2026-10-11): user ingin bisa menjawab pertanyaan
semacam "panen tahun kemarin di kategori Sawah keluar-masuknya
berapa?" atau "kemarin beli skin game Aspirant abis berapa?" — yaitu
ringkasan transaksi dalam SATU kategori, dibatasi rentang tanggal
custom yang punya nama/makna sendiri (bukan filter bulan/tahun
kalender biasa seperti `period-picker` yang sudah ada).

Keputusan desain inti (lihat detail lengkap di dokumen desktop):
- **Periode tersimpan sebagai entitas bernama** (bukan filter sesaat)
  — tabel baru `category_periods` (`id`, `category_id`, `name`,
  `start_date`, `end_date`).
- **Scope per SATU kategori**, bukan lintas kategori/many-to-many.
- Ringkasan (total masuk/keluar/selisih + daftar transaksi) **selalu
  dihitung on-the-fly** dari tabel `transactions` yang sudah ada —
  TIDAK ada tabel ledger/history baru, TIDAK ada kolom agregat
  tersimpan.
- **BEDA dari konsep "Budget"** (`apps/desktop/docs/todos/plan/budget-feature.md`,
  belum diimplementasi) — Budget itu forward-looking (target/limit
  nominal dibandingkan aktual), Periode ini backward-looking
  (ringkasan histori yang sudah terjadi). Independen, tidak saling
  menggantikan.