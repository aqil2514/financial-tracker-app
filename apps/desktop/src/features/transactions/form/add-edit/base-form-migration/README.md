# `base-form-migration`

Patokan/referensi untuk migrasi form transaksi utama ke pola `BaseForm`
(`@/components/forms/base-form.tsx`) — BELUM menggantikan dialog
create/edit yang aktif. Sisi CREATE sudah di-wire ke dialog UJI COBA
terpisah (`TransactionCreateDialogBaseForm`, lihat "Dialog uji coba"
di bawah) untuk verifikasi runtime, hidup berdampingan dengan dialog
asli — bukan "naik pangkat" menggantikan. Lihat rencana lengkap migrasi
final di `docs/todos/plan/unify-direct-writeoff-into-main-transaction-form.md`
bagian "Refactor".

Folder ini **MANDIRI SEPENUHNYA** — tidak mengimpor apa pun dari
`components/`/`hooks/`/`fields/`/`schema/` LAMA (`form/add-edit/...` di
luar folder ini), kecuali lewat alias generik (`@/lib/*`, `@/shared/*`,
`@/components/*`, `@/features/accounts`, `@/features/categories`).
Semua yang dulu "dipakai bersama" (mutationFn create/update, helper
DB, field komponen kompleks, schema) sudah DIDUPLIKASI ke sini supaya
tidak ada ketergantungan silang — begitu migrasi final, folder ini
"naik pangkat" pindah ke lokasi aslinya menggantikan versi lama;
begitu dibatalkan, folder ini cukup dihapus satu unit tanpa menyentuh
apa pun yang aktif.

## Struktur

```
base-form-migration/
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

TIDAK ADA folder `fields/` terpisah untuk komponen presentational
generik (`ContactField`/`DebtActionField`/`InvestmentFields` versi
LAMA yang terima `control`/`form` lewat props) — semuanya DIGABUNG ke
dalam `components/fields/field-*.tsx` masing-masing, jadi satu file
self-contained per field yang langsung baca `useTransactionFormFields()`
tanpa props sama sekali. Beda dari versi LAMA (`form/add-edit/fields/`)
yang generik karena dipakai bareng form lain di luar transaksi
(`new-debt-form`, dst) — salinan di `base-form-migration/` TIDAK
generik, cuma dipakai satu field masing-masing, jadi tidak ada alasan
mempertahankan pemisahan presentational/container.

## Field kompleks dipecah per komponen (bukan lagi satu JSX besar)

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
keduanya mutually exclusive berdasarkan `type === "transfer"` — JSX
aslinya juga sudah menyatukan percabangan ini di satu tempat.

## Dialog "Tambah Akun Baru" / "Tambah Kategori Baru"

Dipicu dari combobox Akun/Kategori (`onCreateNew`) saat user mengetik
nama yang belum ada — supaya tidak perlu keluar dari form transaksi
untuk bikin akun/kategori dulu. `CreateAccountDialog`/`CreateCategoryDialog`
(`components/fields/`) baca semua state-nya dari
`useTransactionFormFields()` tanpa props — `useCreateAccount`/
`useCreateCategory` DIPINDAH ke dalam `TransactionFormFieldsProvider`
(bukan lokal di `TransactionFormWithBaseForm` lagi) karena
`useCreateAccount`'s `onCreated` butuh `form.setValue(...)`, yang
sudah tersedia di context.

## Bug ditemukan & diperbaiki: validasi tambahan terlewat

Versi SEBELUM dipecah (`onSubmit={onSubmit}` langsung ke `BaseForm`)
melewatkan `validateDebtFields`/`validateInvestmentFields` dari
`useTransactionForm()` — `BaseForm` sendiri sudah memanggil
`form.handleSubmit(onSubmit)` (validasi ZOD doang), jadi `onSubmit`
mentah dari props TIDAK PERNAH melewati validasi tambahan itu (hal
seperti unit investasi oversell atau piutang terkunci bisa lolos
submit tanpa tertangkap). Versi LAMA (`components/index.tsx`) aman
karena memang pakai `handleSubmit` (hasil `useTransactionForm`)
sebagai `onSubmit` ke `TransactionBaseForm`.

Masalah strukturalnya: `BaseForm` butuh `onSubmit` SEBELUM render-prop
`children(form)` dipanggil, tapi `handleSubmit` yang tervalidasi baru
tersedia DI DALAM `children(form)` (lewat `TransactionFormFieldsProvider`,
yang butuh `form` dari `BaseForm`). Solusi: `handleSubmitRef`
(`useRef`) dipegang di `TransactionFormWithBaseForm`, `BaseForm`
terima `submitViaRef` (fungsi STABIL secara identitas, baca
`handleSubmitRef.current` saat dipanggil) sebagai `onSubmit`-nya,
sementara `TransactionFormFieldsProvider` meng-update
`handleSubmitRef.current = fields.handleSubmit` tiap render lewat
`useEffect` tanpa dependency array (selalu jalan, supaya ref selalu
pegang versi `handleSubmit` TERBARU, bukan basi dari render pertama).

## Dialog uji coba (CREATE)

`TransactionCreateDialogBaseForm` (`features/transactions/dialog/transaction-create-dialog.tsx`,
komponen KEDUA di file yang sama, di bawah `TransactionCreateDialog`
asli) — dialog SEMENTARA untuk membuktikan jalur `BaseForm` CREATE
jalan di runtime sungguhan, BUKAN pengganti dialog asli:

- Dipicu `dialog.type === "create-base-form"` (varian BARU, ditambah
  ke `TransactionDialogType` di `dialog/context.tsx`, tanpa menghapus
  varian lain) — trigger-nya tombol "Tambah (BaseForm)" di
  `transactions/header/index.tsx`, di sebelah tombol "Tambah
  Transaksi" asli.
- Didaftarkan bareng dialog lain di `dialog/index.tsx` lewat
  `<TransactionsDialogs>`.
- BELUM handle `pendingAttachments` (lampiran sebelum `transactionId`
  ada) seperti `TransactionCreateDialog` asli — field Lampiran TIDAK
  muncul sama sekali di form ini untuk sekarang.
- Semua bagian ini (varian dialog type, tombol trigger, komponen
  dialog) murni untuk pengujian — cabut lagi begitu pengujian BaseForm
  selesai, TIDAK dimaksudkan permanen.

## Status

- **Create — terbukti BENAR secara RUNTIME, SETELAH pemecahan field +
  fix bug validasi (2026-10-14).** Dua putaran verifikasi lewat dialog
  uji coba (`tauri dev` + `finance.dev.db` dev beneran), tiap kali
  diverifikasi LANGSUNG ke database (lihat
  `docs/rules/checking-dev-database.md`), BUKAN cuma percaya toast
  sukses:
  1. Putaran pertama (SEBELUM pemecahan field): kasus expense sederhana
     — baris `transactions` ter-INSERT benar, label ter-`attach`,
     `cloud_sync_queue` dapat entry `transactions`+`transaction_labels`.
  2. Putaran kedua (SETELAH pemecahan field jadi komponen + fix bug
     validasi + pemindahan dialog create-account/category ke context):
     6 kasus — income, expense, transfer cash↔cash, cash→debt (`debts`
     baru `receivable`/`paid`), debt→cash (`debt_payments` ter-link
     FIFO ke debt yang benar), cash→investment (`investment_purchases`
     `settled`), investment→cash (`investment_sales` dengan
     `realized_pl` benar + `adjustment_transaction_id` ter-link ke
     transaksi "Realized P/L" yang benar-benar ada). SEMUA baris
     turunan (`transaction_labels`/`debts`/`debt_payments`/
     `investment_purchases`/`investment_sales`) masuk `cloud_sync_queue`
     dengan `attempts: 0` tanpa `last_error` — push benar-benar
     berhasil, bukan cuma ter-antri.

  BELUM diuji: lampiran (field-nya belum di-wire di dialog uji coba
  ini — lihat catatan `pendingAttachments` di atas), kasus error
  (validasi gagal, oversell investasi, dst — termasuk belum pernah
  memicu kasus yang SEHARUSNYA ditangkap oleh fix bug validasi, baru
  terbukti kasus yang SEHARUSNYA lolos memang lolos).
- **Update — prefill SUDAH diwire, terbukti kompatibel secara TIPE**
  (`tsc --noEmit` lolos saat `TransactionFormWithBaseForm` dan
  `useUpdateTransactionBaseForm` — LENGKAP dengan `defaultValues` dari
  `transactionValuesFromRow` — disambungkan) — BELUM pernah dirender
  di `tauri dev`, BELUM terbukti perilaku runtime SAMA SEKALI.

  **Race `label_names` (bug nyata 2026-10-10) — SUDAH tertangani
  lewat kontrak `isLoading`, BUKAN lewat `useEffect` manual seperti
  versi lama.** `BaseForm` punya `useEffect(() => form.reset(defaultValues),
  [defaultValues])` bawaan — form-nya BUKAN dibuat sekali lalu
  dibiarkan statis. Konsekuensinya dua arah:
  - KALAU caller mem-mount `TransactionFormWithBaseForm` sebelum
    `labelNames` selesai (`isLoading` diabaikan), `defaultValues`
    berubah referensi begitu query itu resolve → `form.reset` kepanggil
    ULANG → race SEBENARNYA tertutup (`label_names` akhirnya keisi),
    TAPI `form.reset` me-reset SELURUH field, bukan cuma `label_names`
    — kalau user sempat mulai mengetik field lain di jendela waktu itu,
    ketikannya HILANG tertimpa reset.
  - Solusi yang dipilih: **kontrak keras** — caller WAJIB
    `if (isLoading) return null` (atau skeleton) SEBELUM mem-render
    `TransactionFormWithBaseForm`. Ini kontrak, belum ada ENFORCEMENT
    runtime — belum ada dialog pemanggil nyata yang membuktikan
    kontrak ini dipatuhi.
  - Efek `[defaultValues]` itu JUGA yang menjawab "ganti transaksi yang
    diedit tanpa unmount dialog" — begitu `transaction` prop berganti,
    `transactionValuesFromRow` menghasilkan `defaultValues` baru,
    `BaseForm` reset otomatis.
  - Validasi blokir edit (`DebtEditBlockedError`) belum pernah dipicu
    di jalur baru — tersambung secara kode (`applyDebtTransactionEdit`
    dipanggil dari `updateDebtTransfer`), belum diverifikasi error-nya
    nyampe ke UI dengan benar.
