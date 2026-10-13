# `base-form-migration`

Patokan/referensi untuk migrasi form transaksi utama ke pola `BaseForm`
(`@/components/forms/base-form.tsx`) — belum menggantikan apa pun,
BELUM di-wire ke dialog/halaman manapun. Lihat rencana lengkap di
`docs/todos/plan/unify-direct-writeoff-into-main-transaction-form.md`
bagian "Refactor".

Dipisah ke folder tersendiri (mirror struktur `components/`/`hooks/`
yang lama) supaya tidak bingung membedakan mana yang AKTIF dipakai
(`components/index.tsx`, `hooks/use-create-transaction/index.ts`, dkk)
dan mana yang masih percobaan — begitu migrasi ini dianggap final,
isi folder ini "naik pangkat" pindah ke lokasi aslinya menggantikan
versi lama; begitu migrasi ini dibatalkan, folder ini cukup dihapus
satu unit tanpa menyentuh apa pun yang aktif.

## Isi

- `components/transaction-form-with-base-form.tsx` — `TransactionFormWithBaseForm`,
  versi `TransactionForm` yang langsung pakai `BaseForm` generik (bukan
  `TransactionBaseForm`).
- `hooks/use-create-transaction/index-base-form.ts` — `useCreateTransactionBaseForm`,
  versi `useCreateTransaction` yang pakai `useDbMutation` langsung
  (pola `useCreateAccount`), BUKAN `useEntityForm`.
- `hooks/use-create-transaction/type-base-form.ts` — opsi untuk hook di
  atas, lebih ramping dari versi lama (tanpa `open`/`defaultAccountId`).
- `hooks/use-create-transaction/handle-create-success.ts` — `onSuccess`
  dipisah jadi fungsi sendiri, terima `options` apa adanya.

`createTransaction` (mutationFn) TIDAK ikut dipindah ke sini — tetap di
lokasi lama (`../hooks/use-create-transaction/create-transaction/`),
di-reuse langsung dari situ, karena logic mutation murni itu sudah
lepas dari `useEntityForm` sejak refactor sebelumnya dan dipakai
BERSAMA oleh versi lama maupun patokan baru ini.

## Status

- **Create — terbukti kompatibel secara TIPE** (`tsc --noEmit` lolos
  saat `TransactionFormWithBaseForm` dan `useCreateTransactionBaseForm`
  disambungkan) — BELUM pernah dirender di `tauri dev`, jadi BELUM
  terbukti secara perilaku runtime.
- **Update — BELUM disentuh sama sekali.** `use-update-transaction`
  masih 100% versi lama. Edit punya kerumitan tambahan yang belum
  dipikirkan di sini: `defaultValues` bergantung beberapa query async
  (`useContacts`, `useTransactionDebtStatus`, dst), sinkronisasi manual
  `label_names` yang sudah pernah jadi bug nyata (2026-10-10), dan
  validasi blokir edit (`DebtEditBlockedError`).
- Field kompleks (`account_id`/`amount`/dst) MASIH dipanggil via
  `useTransactionForm()` di dalam render-prop `children(form)` —
  context pembungkus yang direncanakan sebelumnya (lihat handover
  2026-10-13) BELUM dibuat, ditunda sampai arah migrasi ini lebih jelas.
