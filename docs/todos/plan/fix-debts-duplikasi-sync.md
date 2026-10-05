# Fix: Duplikasi `debts`/`debt_payments` (desktop vs Worker) — Index Navigasi

> Index navigasi utk SATU fitur lintas-app spesifik. Lihat
> [`../README.md`](../README.md) utk penjelasan umum struktur
> `docs/todos/{plan,done}/` di root repo.

Index ini HANYA navigasi + checklist ringkas. Detail keputusan desain,
riset, dan progress implementasi ada di dokumen masing-masing app —
JANGAN duplikasi isi ke sini, cukup pointer.

## Status & TODO saat ini (ringkas)

Bug ditemukan dogfooding 2026-10-05
([docs/dogfooding/2026-10-05-debts-duplikat-desktop-vs-worker.md](../../dogfooding/2026-10-05-debts-duplikat-desktop-vs-worker.md)):
transfer cash↔debt dari desktop menghasilkan baris `debts`/
`debt_payments` DOBEL (satu dari insert lokal desktop, satu dari
Worker yang auto-derive dari transaksi yang sama) — tidak pernah
saling tahu karena `debts`/`debt_payments` TIDAK ada di
`cloud_sync_queue`.

Arah fix (**REVISI keputusan lama** "Worker satu-satunya penulis D1"
di [cloud-sync-mcp.md](../done/cloud-sync-mcp.md) — lihat catatan
revisi yang ditambahkan ke dokumen itu): **source-based ownership**.
PC jadi penulis `debts`/`debt_payments` untuk transaksinya sendiri
(konsisten offline-first — langsung terlihat tanpa nunggu pull),
Worker tetap jadi penulis untuk transaksi dari MCP/sumber non-PC
lainnya (retailku sync).

- [ ] **Worker** — syarat `syncSource !== 'pc'` sebelum auto-derive
      `debts`/`debt_payments` dari transaksi. Endpoint push baru
      (upsert-by-id murni, tanpa bikin transaksi closing). Detail:
      [`apps/worker/docs/todos/plan/fix-debts-duplikasi-sync.md`](../../../apps/worker/docs/todos/plan/fix-debts-duplikasi-sync.md)
- [ ] **Desktop** — migrasi `cloud_sync_queue` (tambah `debts`,
      `debt_payments` ke CHECK constraint), `QueueableTable` baru,
      `push-row.ts`/`worker-client.ts` baru, titik panggil
      `pushOnWrite` di 5 lokasi yang sudah menulis `debts`/
      `debt_payments` lokal. Detail:
      [`apps/desktop/docs/todos/plan/fix-debts-duplikasi-sync.md`](../../../apps/desktop/docs/todos/plan/fix-debts-duplikasi-sync.md)
- [ ] **Pembersihan data** — baris `debts`/`debt_payments` duplikat
      yang SUDAH ada (lokal `finance.db`, minimal 3 kontak diketahui
      kena: Kak Ipit, Mama Dicky, Wahyu) belum dibersihkan — tunggu
      fix kode selesai dulu supaya tidak dobel lagi setelah dibersihkan
      (lihat dogfooding doc untuk daftar `id` yang sudah teridentifikasi).

## Gap terpisah (TIDAK masuk scope fix ini)

Ditemukan saat riset: transaksi yang dibuat lewat shortcut halaman
`/debts` (`use-create-debt.ts` mode transfer, `use-pay-debt.ts` mode
cash dengan `debt.account_id` terisi) **TIDAK PERNAH ter-push ke
Worker sama sekali** — beda akar masalah dari bug duplikasi ini (ini
soal transaksi yang HILANG dari sync, bukan DOBEL). Dicatat di sini
sebagai pointer, belum ada dokumen rencana terpisah — perlu dibuatkan
kalau mau dikerjakan.

## Latar belakang

Lihat dogfooding doc
[2026-10-05-debts-duplikat-desktop-vs-worker.md](../../dogfooding/2026-10-05-debts-duplikat-desktop-vs-worker.md)
untuk kronologi investigasi lengkap (query production D1 + local
SQLite yang membuktikan root cause).
