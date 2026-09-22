# Handover — 2026-09-22

## 1. Refactoring struktur folder `features/transactions/` berdasarkan `page-layout.md`

### Sudah selesai

- Dialog transaksi (create/edit/detail/delete-confirm) dipisah dari pola lama
  (trigger+dialog tercampur, N-instance per item) menjadi context-based, 1
  instance per dialog — dibangun `hooks/use-dialog-state.ts` +
  `hooks/create-dialog-context.tsx` sebagai infrastruktur generic,
  didokumentasikan di `docs/rules/dialog-pattern.md` (baru).
- `list/` dan `calendar/` dipindah ke dalam `content/` (`content/list/`,
  `content/calendar/`) — sebelumnya sejajar dengan `content/`, salah secara
  struktur.
- `useTransactionById` dipindah dari `content/list/` ke `shared/` (baru) —
  dipakai lintas 3 dialog, bukan milik satu section.
- Dead code dibersihkan: `list-context.tsx`'s
  `deleteTransaction`/`isDeletingTransaction` (sisa migrasi),
  `form/transaction-form-dialog.tsx` + `form/use-create-transaction.ts` lama,
  `form/transaction.schema.ts` lama (duplikat).
- `docs/rules/page-layout.md` diperluas signifikan — dari 4 kategori awal
  (header/content/footer/dialog) jadi 7 kategori (+ `page/`, `form/`,
  `shared/`), plus dua konsep rekursi: section di dalam `content/` boleh
  punya header/content/footer sendiri (contoh: `content/list/`), dan dialog
  individual di `dialog/` boleh direkursi jadi folder sendiri kalau kompleks.
- `components/entity-form.tsx` (baru, generic form wrapper dengan
  `FormProvider`) dan `components/entity-form-dialog.tsx`/`form-fields/`
  dipindah ke `components/forms/`.
- `form/add-edit/` — versi baru `useEntityForm` (di
  `components/forms/hooks/`, expose `keepOpen` ke `onSuccess`, `open`
  dikontrol dari luar) dipakai `use-create-transaction.ts`/
  `use-update-transaction.ts` baru.

### Belum tuntas — lanjut sesi berikutnya

- `form/transaction-edit-dialog.tsx` dan `form/use-update-transaction.ts`
  (versi **lama**) masih hidup, dipakai `DeepLinkEditDialog` — sengaja
  ditunda karena satu-satunya sumber deep-link (`?edit=<id>`) berasal dari
  `accounts/dialogs/.../detail-tab.tsx` yang rencananya akan didesain ulang.
- Nama file `transaction-edit-dialog.tsx` yang identik di 2 lokasi (`form/`
  lama vs `dialog/` baru) — berisiko ambigu, belum dirapikan.
- `typeConfig` dan `accountName`/`categoryName` terduplikasi persis di
  `content/list/transaction-list-item.tsx` dan
  `dialog/transaction-detail-dialog.tsx` — kandidat untuk
  `shared/constants.ts`/`shared/utils/`, belum dieksekusi.
- `hooks/use-entity-form.ts` (versi lama di root `hooks/`) masih dipakai
  12+ fitur lain (accounts, contacts, categories, dst) — belum
  dimigrasikan ke versi baru (`components/forms/hooks/use-entity-form.ts`).

## 2. Duplikasi transaksi hasil sync Retailku

- **Root cause**: `source_ref` transaksi hasil `syncCashflow` menyertakan
  mode sync sebagai bagian key (`"2026-09-22:accId"` untuk mode ringkas vs
  `"2026-09-22:accId:SALE"` untuk mode detail) — ganti mode untuk periode
  yang sama menghasilkan idempotency check yang tidak mendeteksi overlap,
  sehingga insert dobel.
- Dikonfirmasi lewat MCP `Warung Aqil`: mode "detail" **aman dipakai**,
  tidak menyebabkan spam — dia mengagregasi per `sourceType` (kategori:
  SALE, SALE_PAYMENT, DIRECT_PURCHASE, INVESTMENT_TRANSACTION), bukan per
  transaksi individual.
- **Database produksi (`finance.db`) sudah dibersihkan** — 10 transaksi
  `retailku_sync` + 4 `debts` terkait (22 September) dihapus,
  `retailku_cashflow_last_auto_sync_date` direset supaya sync ulang
  memproses periode itu lagi.
- **Belum diperbaiki**: root cause di kode (`sync-cashflow.ts`) —
  `source_ref` perlu dibuat invariant terhadap mode sync, supaya ganti
  mode di masa depan tidak menghasilkan duplikasi lagi.
