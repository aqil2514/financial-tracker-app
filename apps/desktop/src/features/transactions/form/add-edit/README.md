# Form transaksi utama

Form Tambah/Edit Transaksi aktif, dipakai `TransactionCreateDialog`/
`TransactionEditDialog` (`features/transactions/dialog/`). Dibangun di
atas `BaseForm` generik (`@/components/forms/base-form.tsx`) — hasil
migrasi dari pola lama (`useEntityForm` + `TransactionBaseForm` wrapper
manual) yang selesai 2026-10-14. Rencana migrasi & verifikasi lengkap
ada di `docs/todos/plan/unify-direct-writeoff-into-main-transaction-form.md`
bagian "Refactor".

## Struktur

```
add-edit/
  components/
    transaction-form-with-base-form.tsx   TransactionFormWithBaseForm (orkestrator, TIDAK ADA JSX field langsung)
    fields/
      field-note.tsx, field-date.tsx, field-description.tsx        (sederhana, cuma useFormContext())
      field-transaction-type.tsx, field-amount.tsx, field-account-id.tsx,
      field-transfer-account-or-category.tsx, field-contact-name.tsx,
      field-debt-action.tsx, field-label.tsx, field-investment.tsx,
      field-attachments.tsx                                        (kompleks, baca useTransactionFormFields())
      create-account-dialog.tsx, create-category-dialog.tsx         (dialog sekunder, trigger dari field combobox)
  context/
    transaction-form-fields-context.tsx   TransactionFormFieldsProvider / useTransactionFormFields
  hooks/
    use-transaction-form.ts, use-account-category-options.tsx,
    use-transaction-debt-fields.ts, use-transaction-investment-fields.ts
    helper/{insert-to-db,update-to-db,apply-labels-and-push,index}.ts
    create-transaction/{index,income,expense}.ts + transfer/{index,cash,debt,investment}.ts
    update-transaction/{index,income,expense}.ts + transfer/{index,cash,debt,investment}.ts
    use-create-transaction/{index-base-form,type-base-form,handle-create-success}.ts
    use-update-transaction/{index-base-form,type-base-form}.ts
  schema/{schema,values,index}.ts
```

`ContactField`/`DebtActionField`/`InvestmentFields` versi presentational
generik (terima `control`/`form` lewat props) yang dulu ada di sini
SUDAH DIHAPUS — field kompleks sekarang satu file self-contained per
field (`components/fields/field-*.tsx`) yang langsung baca
`useTransactionFormFields()` tanpa props sama sekali. `ContactField`
yang MASIH generik (dipakai `new-debt-form`, `third-party`, di luar
form transaksi) dipindah ke `@/shared/contacts/contact-field.tsx`.

## Field kompleks dipecah per komponen (bukan satu JSX besar)

`TransactionFormWithBaseForm` murni orkestrator — tinggal daftar
`<FieldX/>` berurutan. Pembagiannya:

- **Field sederhana** (`FieldNote`, `FieldDate`, `FieldDescription`) —
  cuma butuh `useFormContext()` (dari `FormProvider` bawaan
  `BaseForm`), TIDAK butuh context tambahan.
- **Field kompleks** (`FieldTransactionType`, `FieldAmount`,
  `FieldAccountId`, `FieldTransferAccountOrCategory`,
  `FieldContactName`, `FieldDebtAction`, `FieldLabel`,
  `FieldInvestment`, `FieldAttachments`) — saling bergantung lewat SATU
  hasil `useTransactionForm()` bersama (`type`, `debtFieldsLocked`,
  `accountOptions`, dst dipakai LINTAS banyak field sekaligus; dua
  `useEffect` di dalam `useTransactionForm` — auto-ubah `type` jadi
  `"transfer"` kalau akun sumber `debt` — juga harus jalan SEKALI,
  bukan per-field). Dibaca lewat `useTransactionFormFields()`
  (`context/transaction-form-fields-context.tsx`), context yang
  memanggil `useTransactionForm()` SEKALI di `TransactionFormFieldsProvider`
  lalu menyebarkan hasilnya + `form` + state dialog create-account/
  create-category + props Lampiran (`transactionId`/`pendingAttachments`/
  `onPendingAttachmentsChange`/`isPending`) ke semua field di bawahnya.

`FieldTransferAccountOrCategory` menggabungkan DUA field asli
(`transfer_account_id` vs `category_id`) jadi satu komponen karena
keduanya mutually exclusive berdasarkan `type === "transfer"`.

## Dialog "Tambah Akun Baru" / "Tambah Kategori Baru"

Dipicu dari combobox Akun/Kategori (`onCreateNew`) saat user mengetik
nama yang belum ada — supaya tidak perlu keluar dari form transaksi
untuk bikin akun/kategori dulu. `CreateAccountDialog`/`CreateCategoryDialog`
(`components/fields/`) baca semua state-nya dari
`useTransactionFormFields()` tanpa props — `useCreateAccount`/
`useCreateCategory` ada di `TransactionFormFieldsProvider` karena
`useCreateAccount`'s `onCreated` butuh `form.setValue(...)`, yang
tersedia di context.

## `defaultAccountId` (Create)

`TransactionCreateDialog` terima prop `defaultAccountId` (dipakai
halaman detail akun, supaya akun itu otomatis terpilih saat buka
"Tambah Transaksi" dari situ) — diterapkan lewat
`defaultTransactionValues({ account_id: defaultAccountId ?? "" })`,
BUKAN parameter terpisah di `useCreateTransactionBaseForm` (hook
mutation-nya sendiri tidak perlu tahu soal ini).

## Kontrak `isLoading` (Update)

`useUpdateTransactionBaseForm` return `isLoading` — caller WAJIB
`if (isLoading) return null` SEBELUM me-render `TransactionFormWithBaseForm`
(lihat `TransactionEditDialog`). Alasan: `BaseForm` punya
`useEffect(() => form.reset(defaultValues), [defaultValues])` bawaan —
kalau form di-mount sebelum semua data pendukung (status debt,
investment, label) siap, `defaultValues` berubah referensi begitu
query-query itu resolve, `form.reset` terpanggil ULANG dan me-reset
SELURUH field (bukan cuma field yang tadinya kosong) — kalau user sudah
sempat mengetik di jendela waktu itu, ketikannya hilang tertimpa reset.
Kontrak `isLoading` mencegah kondisi ini sama sekali, sekaligus
menjawab gratis "ganti transaksi yang diedit tanpa unmount dialog"
(begitu `transaction` prop berganti, `defaultValues` baru dihasilkan,
`BaseForm` reset otomatis ke transaksi yang baru).

## Transfer `debt-debt` sengaja tanpa efek ke `debts`/`debt_payments`

`applyDebtTransaction` (`shared/debts/apply-debt-transaction/create.ts`)
explicit `return none` untuk `pairKind === "debt-debt"` — bukan gap,
keputusan desain. Piutang/utang melekat ke KONTAK (`debts.contact_id`),
bukan ke akun — satu baris `debts` cuma punya satu `contact_id`.
Transfer antar 2 akun bertipe `debt` tidak punya cara sahih menentukan
kontak mana yang terlibat di tiap sisi (transaksinya sendiri cuma bawa
SATU `contact_id`), jadi daripada menebak/menyamaratakan salah, tidak
ada baris `debts`/`debt_payments` yang dibuat sama sekali — murni
relokasi saldo akun (via `transactions`), sama seperti transfer
cash↔cash. `isDebtDebtTransfer` (`use-transaction-debt-fields.ts`)
DIKECUALIKAN dari `involvesDebtAccount` (kontak jadi tidak wajib) DAN
dipakai `FieldContactName` untuk men-disable combobox-nya sepenuhnya
(pola sama `debtFieldsLocked`) — field tidak relevan untuk `debt-debt`,
jadi dinonaktifkan daripada dibiarkan aktif tapi menyimpan nilai yang
tidak mempengaruhi `debts`/`debt_payments` sama sekali. Catatan: nilai
`contact_name` TETAP ikut tersimpan ke `transactions.contact_id` kalau
sempat terisi SEBELUM akun diganti jadi kombinasi `debt-debt` (field
di-disable, bukan di-reset — konsisten pola `debtFieldsLocked`) — efeknya
cuma nongol di `TransactionDetailDialog` (satu-satunya tempat yang baca
`transactions.contact_id` langsung, lihat `transaction-detail-dialog.tsx`),
sama sekali tidak mempengaruhi riwayat kontak (`use-contact-debts.ts`
baca dari tabel `debts`, bukan `transactions`).

## Bug yang pernah ditemukan & diperbaiki

- **Validasi tambahan terlewat di jalur submit** (2026-10-14) — versi
  SEBELUM field dipecah pakai `onSubmit={onSubmit}` langsung ke
  `BaseForm`, melewatkan `validateDebtFields`/`validateInvestmentFields`
  dari `useTransactionForm()` (`BaseForm` sendiri cuma panggil
  `form.handleSubmit(onSubmit)`, validasi Zod doang). Solusi: pola
  `handleSubmitRef` (`useRef`, dipegang `TransactionFormWithBaseForm`,
  di-update tiap render oleh `TransactionFormFieldsProvider` lewat
  `useEffect` tanpa dependency array) — `BaseForm` terima fungsi STABIL
  (`submitViaRef`) yang membaca `handleSubmitRef.current` saat
  dipanggil, bukan `onSubmit` mentah.
- **Transfer ganti pasangan akun lintas domain investment↔debt
  menyisakan baris turunan yatim** (ditemukan 2026-10-14, BELUM
  diperbaiki) — lihat
  [docs/dogfooding/2026-10-14-transfer-ganti-pasangan-akun-silang-investment-debt-sisakan-baris-yatim.md](../../../../../../docs/dogfooding/2026-10-14-transfer-ganti-pasangan-akun-silang-investment-debt-sisakan-baris-yatim.md).
  Bukan regresi migrasi BaseForm — sudah ada sejak sebelumnya.

## Verifikasi runtime (2026-10-14)

Semua lewat `tauri dev` + cek `finance.dev.db` langsung (bukan cuma
toast UI), sesuai `docs/rules/checking-dev-database.md`:

- **Create**: income, expense, transfer cash↔cash/cash→debt/debt→cash/
  cash→investment/investment→cash — semua baris turunan
  (`debts`/`debt_payments`/`investment_purchases`/`investment_sales`)
  benar DAN masuk `cloud_sync_queue` tanpa error. Lampiran (upload
  sebelum `transactionId` ada → `transaction_attachments` ter-link
  benar setelah submit). Validasi gagal tertangkap: `validateInvestmentFields`
  (status Settled tanpa unit/harga, ditolak sebelum submit) dan
  `InsufficientInvestmentUnitsError` (oversell unit, ditolak di
  mutation TANPA baris `transactions` yatim).
- **Update**: prefill (kontrak `isLoading`), field debt yang sudah
  dicicil terkunci di UI (pesan jelas), edit field aman pada piutang
  yang sudah dicicil tidak merusak `debt_payments`, transfer
  cash→debt, cash→investment, cash↔cash, debt→cash (settlement FIFO)
  — semua benar di database + `cloud_sync_queue`.

**Belum pernah dicoba**: investment-sell (jual) via Update,
`debt_action: "payable"` (utang baru) via Update, `DebtEditBlockedError`
terpicu sampai ke UI (field berbahaya sudah terkunci di UI duluan,
jadi jalur error di level mutation kemungkinan jarang/tidak pernah kena
lewat form normal).
