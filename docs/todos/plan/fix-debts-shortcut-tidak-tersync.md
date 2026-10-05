# Fix: transaksi dari shortcut `/debts` tidak ter-push ke Worker

> Index navigasi utk fitur lintas-app. Lihat
> [`../README.md`](../README.md) utk penjelasan umum struktur
> `docs/todos/{plan,done}/` di root repo.

## Status & TODO saat ini (ringkas)

Ditemukan sbg gap TERPISAH saat riset fix duplikasi `debts`
([`done/fix-debts-duplikasi-sync.md`](../done/fix-debts-duplikasi-sync.md)
— SELESAI, dipindah ke `done/`): transaksi yang dibuat lewat shortcut
halaman `/debts` (bukan form Transaksi utama) **TIDAK PERNAH ter-push
ke Worker sama sekali** — beda akar masalah dari bug duplikasi (itu
soal DOBEL, ini soal HILANG dari sync).

- [ ] `new-debt-form/use-create-debt.ts` — 2 titik, KEDUANYA cuma
      push `debts` (ditambahkan saat fix duplikasi), TIDAK push
      `transactions`:
      - mode `record_mode === 'direct'` (baris ~74-102): insert
        `transactions` (transaksi penutup) + `debts` manual langsung.
        Tambahkan `void pushOnWrite("transactions", transactionId)`
        SEBELUM/SEJAJAR `void pushOnWrite("debts", debtId)` yang
        sudah ada.
      - mode `record_mode === 'transfer'`: insert `transactions`
        (transfer kas↔debt) + panggil `applyDebtTransaction`. Tambahkan
        `void pushOnWrite("transactions", transactionId)` sejajar push
        `debts`/`debt_payments` yang sudah ada dari hasil
        `touchedDebtRows`.
- [ ] `pay-debt-form/use-pay-debt.ts` — SEMUA cabang (non_cash tanpa
      account_id, non_cash dgn account_id, cash tanpa account_id, cash
      dgn account_id via `applyDebtTransaction`) insert `transactions`
      TANPA push, KECUALI cabang `transaction_id: NULL` (non_cash tanpa
      account_id — di situ memang tidak ada `transactions` apa pun utk
      di-push, lihat komentar "SATU-SATUNYA kasus tanpa transaksi
      penutup" di file itu). Tambahkan `pushOnWrite("transactions", ...)`
      di 3 cabang yang PUNYA `transactionId`.
- [ ] Worker — TIDAK perlu endpoint baru, `POST /transactions` yang
      sudah ada sudah generik (upsert-by-id + LWW), cukup dipanggil dari
      titik-titik di atas. Perlu diverifikasi: `createTransactionRow`
      tidak keberatan menerima transaksi `type: income/expense` TANPA
      `categoryId` (mode `direct` `/debts`, kategori selalu NULL) — cek
      `validateCategoryExists` treat `categoryId` null sbg skip (`if
      (!categoryId) return { status: "ok" }`, sudah begitu, SEHARUSNYA
      aman tapi WAJIB dicoba manual sebelum anggap selesai).
- [ ] Verifikasi manual via `tauri dev` + `wrangler dev`: buat piutang
      baru lewat `/debts` (mode direct DAN transfer), bayar piutang
      lewat `/debts` (3 cabang yang punya transaksi), cek transaksinya
      MUNCUL di D1 (lokal dulu, baru production setelah deploy) — bukan
      cuma `debts`/`debt_payments`-nya.

## Kenapa ini beda dari fix duplikasi `debts`

Fix duplikasi (`done/fix-debts-duplikasi-sync.md`) menyelesaikan
masalah "2 penulis independen bikin baris `debts` dobel". Sbg bagian
dari fix itu, 5 titik yang menulis `debts`/`debt_payments` lokal
ditambahkan `pushOnWrite("debts"/"debt_payments", ...)` — TERMASUK 2
titik di `use-create-debt.ts`/`use-pay-debt.ts` yang jadi scope
dokumen ini. TAPI titik-titik itu JUGA menulis baris `transactions`
baru (transaksi penutup/transfer) yang SAMA SEKALI tidak pernah
dipush — gap ini sudah ada SEBELUM fix duplikasi, tidak diperlebar
atau diperbaiki saat itu (sengaja, supaya scope fix duplikasi tetap
fokus — lihat catatan di dokumen `done/`).

Akibat konkret: piutang/utang yang dicatat lewat shortcut `/debts`
baris `debts`/`debt_payments`-nya SEKARANG sudah ter-push (fix
duplikasi), tapi transaksi `transactions` yang jadi "jejak" baris itu
TIDAK ada di cloud — kalau user buka dari HP/asisten AI (MCP), transaksi
penutup ini tidak akan terlihat sama sekali walau piutangnya sendiri
kelihatan (krn `debts.transaction_id` merujuk ke transaksi yang tidak
ada di D1 — berpotensi FK dangling kalau suatu saat ada constraint,
atau sekadar "riwayat transaksi tidak lengkap" di laporan/MCP tools
yang query tabel `transactions`).

## Titik perubahan kode (hasil riset, detail persis lihat file)

### 1. `new-debt-form/use-create-debt.ts`

Mode `direct`
([baris ~74-102](../../../apps/desktop/src/shared/debts/new-debt-form/use-create-debt.ts)):
insert `transactions` (transaksi penutup langsung pada akun debt) lalu
insert `debts` manual. Push `debts` SUDAH ada (`pushOnWrite("debts",
debtId)`), push `transactions` BELUM.

Mode `transfer`: insert `transactions` (transfer kas↔debt) lalu
`applyDebtTransaction`. Push `debts`/`debt_payments` dari
`touchedDebtRows` SUDAH ada, push `transactions` BELUM.

### 2. `pay-debt-form/use-pay-debt.ts`

4 cabang (lihat komentar lengkap di file, "Dua sumbu independen"):
1. `settlement_mode: non_cash`, `debt.account_id == null` —
   `transaction_id: NULL`, TIDAK ADA transaksi utk dipush (skip,
   bukan gap).
2. `settlement_mode: non_cash`, `debt.account_id` terisi — insert
   `transactions` (transaksi penutup) + `debt_payments` manual. Push
   `debt_payments` SUDAH ada, push `transactions` BELUM.
3. `settlement_mode: cash`, `debt.account_id == null` — insert
   `transactions` (income/expense biasa) + `debt_payments` manual.
   Push `debt_payments` SUDAH ada, push `transactions` BELUM.
4. `settlement_mode: cash`, `debt.account_id` terisi — insert
   `transactions` (transfer debt→kas) + `applyDebtTransaction`
   (settlement FIFO). Push `debts`/`debt_payments` dari
   `touchedDebtRows` SUDAH ada, push `transactions` BELUM.

## Yang TIDAK berubah

- Worker — `POST /transactions` sudah generik, tidak perlu endpoint
  baru. Perlu DICOBA manual (bukan diasumsikan) utk payload tanpa
  `categoryId` (mode `direct`/non_cash yang selalu `category_id: NULL`
  lokal).
- `pull-sync.ts` — tidak perlu diubah, transaksi yang sekarang ter-push
  akan otomatis ikut ke-pull oleh desktop lain / ditampilkan tools MCP
  seperti transaksi biasa.
- Skema `debts`/`debt_payments` — tidak berubah, `transaction_id` yang
  dirujuk SUDAH benar sejak awal (migrasi 0033 backfill memastikan ini,
  lihat `docs/concept/konsep-transaksi.md`), yang kurang cuma baris
  `transactions`-nya tidak ikut sampai ke cloud.

## Latar belakang

Ditemukan saat riset detail implementasi fix duplikasi `debts`
(Explore agent, 2026-10-05) — dicatat sbg "Gap terpisah (TIDAK masuk
scope fix ini)" di index lama, sekarang dipecah jadi dokumen rencana
sendiri sesuai permintaan user. Lihat juga handover session
2026-10-05 (sesi implementasi + verifikasi fix duplikasi) utk konteks
penuh urutan penemuan.
