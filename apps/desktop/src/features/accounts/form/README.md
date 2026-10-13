# Form akun (LAMA — sedang dimigrasi bertahap)

Folder ini lokasi LAMA untuk form akun. Sejak migrasi `features/accounts`
mengikuti `docs/rules/page-layout.md`, form akun punya lokasi BARU di
[`contents/detail/form/add-edit/`](../contents/detail/form/add-edit/)
(pola berbeda: `BaseForm` + field dipecah per komponen di
`components/fields/`, hook mutation pakai `useDbMutation` langsung tanpa
bikin `form` sendiri — lihat `add-edit/hooks/README.md`).

Migrasi dilakukan SATU PER SATU, bukan sekaligus — folder ini belum bisa
dihapus karena masih ada importer yang belum dipindah.

## Status per file

- `account-form.tsx`, `account.schema.ts`, `use-create-account.ts` — ADA
  versi baru (`add-edit/components`, `add-edit/schema`,
  `add-edit/hooks/use-create-account.ts`), tapi lokasi lama ini MASIH
  dipakai:
  - `features/accounts/dialogs/edit-dialog/` (`AccountEditDialog`,
    dipakai `features/investment-detail/header` — lihat
    `../dialogs/README.md`)
  - `features/investments/header/new-investment-account-dialog.tsx`
  - `features/third-party/content/accounts/dialog/create.tsx`
  - `features/transactions/form/add-edit/form.tsx` (path langsung, bukan
    lewat barrel)
- `use-update-account.ts` — ADA versi baru
  (`add-edit/hooks/use-update-account.ts`), lokasi lama ini MASIH dipakai
  `dialogs/edit-dialog/`.
- `is-account-in-use.ts`, `use-account-is-used.ts` — TIDAK dimigrasi,
  SENGAJA tetap di sini. Logic murni kecil, bukan form-spesifik — dipakai
  langsung dari lokasi ini oleh `contents/detail/dialog/edit/` juga
  (tidak diduplikasi ke lokasi baru).

## Barrel `features/accounts/index.ts`

Masih re-export `AccountForm`/`useCreateAccount`/`accountSchema` dari
lokasi LAMA (`./form`), bukan dari `contents/detail/form`. Ini sebabnya
importer eksternal yang ambil lewat barrel publik
(`@/features/accounts`) masih dapat kontrak lama (`form` jadi dari
`useEntityForm`, bukan `defaultValues`/`onSubmit`/`isPending`). Mengganti
barrel ke lokasi baru adalah bagian dari migrasi bertahap ini juga —
belum dilakukan.
