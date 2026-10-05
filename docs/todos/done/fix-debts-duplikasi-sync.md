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

- [x] **Worker** — syarat `syncSource !== 'pc'` sebelum auto-derive
      `debts`/`debt_payments` dari transaksi. Endpoint push baru
      (upsert-by-id murni, tanpa bikin transaksi closing) PLUS endpoint
      delete baru (`DELETE /debts/push/:id` dkk, ditemukan perlu saat
      test manual — lihat gap di bawah). Kode SELESAI, type-check lolos,
      test manual via `wrangler dev` SELESAI & lolos. Detail:
      [`apps/worker/docs/todos/done/fix-debts-duplikasi-sync.md`](../../../apps/worker/docs/todos/done/fix-debts-duplikasi-sync.md)
- [x] **Desktop** — migrasi `cloud_sync_queue` (tambah `debts`,
      `debt_payments` ke CHECK constraint, versi 34), `QueueableTable`
      baru, `push-row.ts`/`worker-client.ts` baru, titik panggil
      `pushOnWrite`/`pushDeleteOnWrite` di 5+2 lokasi (5 utk upsert, 2
      dari 5 itu jg utk delete-saat-recreate). Kode SELESAI, test migrasi
      (`cargo test`) & test TS (`vitest run`, 172/172) lolos, verifikasi
      manual via `tauri dev` + `wrangler dev` SELESAI & lolos (query D1
      lokal langsung, bukan cuma toast UI). Detail:
      [`apps/desktop/docs/todos/done/fix-debts-duplikasi-sync.md`](../../../apps/desktop/docs/todos/done/fix-debts-duplikasi-sync.md)
- [x] **Pembersihan data** — SELESAI 2026-10-05. Worker di-deploy +
      desktop di-build ulang production, baru 3 transaksi duplikat lama
      (Kak Ipit, Mama Dicky, Wahyu) dihapus TOTAL (transaksi + `debts`
      turunannya, dicek dulu tidak ada `debt_payments` terkait) dari
      `finance.db` lokal + D1 production, lalu diinput ulang via UI
      desktop production. Hasil akhir dicek langsung lewat
      `wrangler d1 execute --remote`: ketiganya cuma 1 baris `debts`
      aktif, termasuk Wahyu yang sempat diedit (membuktikan jalur
      recreate + `DELETE /debts/push/:id` jalan benar). Detail lengkap +
      3 gap TERPISAH yang ketahuan saat verifikasi (kontak tidak
      ter-push, combobox key collision, 422 tidak di-retry):
      [`docs/dogfooding/2026-10-05-verifikasi-fix-debts-duplikat-dan-gap-kontak.md`](../../dogfooding/2026-10-05-verifikasi-fix-debts-duplikat-dan-gap-kontak.md).
      Rilis: [`docs/release/v0.1.4.md`](../../release/v0.1.4.md).

## Gap ditemukan SETELAH rencana awal (lewat test manual, 2026-10-05)

Rencana awal cuma mencakup PUSH baris baru `debts`/`debt_payments` —
TIDAK mencakup kasus desktop men-DELETE baris LAMA saat RECREATE (edit
transaksi yang mengubah field berbahaya). Tanpa endpoint DELETE,
`/debts/push` yang cuma upsert-by-id tidak pernah tahu id lama harus
dihapus → baris menumpuk tiap kali transaksi di-edit. Ditemukan &
ditutup di sesi yang sama (endpoint `DELETE /debts/push/:id` +
`DELETE /debts/payments/push/:id` di Worker, `pushDeleteOnWrite` di 2
titik desktop yang pakai `applyDebtTransactionEdit`) — lihat detail di
kedua dokumen app.

## Gap terpisah (TIDAK masuk scope fix ini)

Ditemukan saat riset: transaksi yang dibuat lewat shortcut halaman
`/debts` (`use-create-debt.ts` mode transfer, `use-pay-debt.ts` mode
cash dengan `debt.account_id` terisi) **TIDAK PERNAH ter-push ke
Worker sama sekali** — beda akar masalah dari bug duplikasi ini (ini
soal transaksi yang HILANG dari sync, bukan DOBEL). Sekarang py
dokumen rencana sendiri:
[`docs/todos/plan/fix-debts-shortcut-tidak-tersync.md`](../plan/fix-debts-shortcut-tidak-tersync.md).

## Latar belakang

Lihat dogfooding doc
[2026-10-05-debts-duplikat-desktop-vs-worker.md](../../dogfooding/2026-10-05-debts-duplikat-desktop-vs-worker.md)
untuk kronologi investigasi lengkap (query production D1 + local
SQLite yang membuktikan root cause).
