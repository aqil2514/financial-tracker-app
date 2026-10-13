# Handover — 2026-10-13 (sesi 1)

Sesi panjang, dua tema besar: (1) migrasi `features/accounts` penuh ke
pola `docs/rules/page-layout.md` + pola form baru (`BaseForm`), yang
lalu menular ke `features/investments` dan `features/third-party`
(sudah SELESAI untuk ketiganya), dan (2) baru MULAI merapikan
`features/transactions/form` dengan pola yang sama — ini BELUM selesai,
jadi fokus utama sesi berikutnya. TIDAK ada permintaan commit sepanjang
sesi ini — SEMUA perubahan masih di working tree.

## Ringkasan hasil sesi (kronologis)

### 1. Bug awal: tombol "Tambah Akun" tidak bisa diklik

`AccountFormDialog` di `contents/detail/dialog/create/index.tsx` pakai
`useCreateAccount()` (internal `useEntityForm`, `open`/`setOpen` SENDIRI)
dicampur dengan `useAccountsDialog()` context luar — gate-mount pattern-nya
rusak. User minta diganti native `Dialog` (bukan `EntityFormDialog`).
Setelah beberapa iterasi, solusi final: `open` MURNI dari
`useAccountsDialog()` context, `useCreateAccount` TIDAK lagi dipakai utk
`form`/`open`-nya — hook itu lalu disederhanakan total (lihat poin 2).

### 2. Pola `BaseForm` baru (`@/components/forms/base-form.tsx`)

Diadaptasi dari `retail-multitenant/apps/web/src/_shared/forms/base-form.tsx`
(proyek lain milik user) — `useForm` dibuat DI DALAM komponennya sendiri
(terima `schema`+`defaultValues`), auto-reset via `useEffect` saat
`defaultValues` berubah referensi (ini SEKALIGUS memperbaiki bug
"form tidak reset saat dialog dibuka-tutup tanpa submit" yang sempat
dibiarkan). Komponen generik, DI LUAR `features/accounts` — lokasi
`src/components/forms/`, sejajar `entity-form-dialog.tsx` lama.

**Hook mutation disederhanakan mengikuti pola ini**: `useCreateAccount`/
`useUpdateAccount` TIDAK lagi bikin `form` sendiri — cukup `useDbMutation`
langsung, return `{ onSubmit, isPending }`. Pembuatan `form` + reset jadi
tanggung jawab `BaseForm` di level pemanggil (dialog).

### 3. Migrasi penuh `features/accounts` ke struktur baru

`contents/detail/form/add-edit/` — `schema/` (`schema.ts`+`values.ts`:
`defaultAccountValues()`+`accountValuesFromEntity()`+`index.ts`+
`README.md`), `hooks/` (`use-create-account.ts`+`use-update-account.ts`+
`README.md`), `components/` (`AccountForm` orkestrator + `fields/`
berisi 8 komponen field kecil: `FieldAccountName`, `FieldInitialBalance`,
`FieldIconColor`, `FieldGroup`, `FieldAccountType`, `FieldInvestment`,
`FieldDescription`, `FieldIsActive` — masing-masing ambil `form` via
`useFormContext()`, TIDAK prop-drilling). Pola field: HANYA field yang
butuh state turunan non-form (mis. `FieldAccountType` butuh efek reset
`initial_balance`) yang punya logic tambahan, sisanya murni render.

3 dialog di `contents/detail/dialog/` (`create/`, `edit/`,
`balance-correction/`) semua dimigrasi ke native `Dialog` + pola
`BaseForm` ini. `balance-correction/` juga dapat struktur sejenis:
`contents/detail/form/balance-correction/{schema,hooks,components}/`.

**Helper kecil dipisah**: `is-account-in-use.ts`/`use-account-is-used.ts`
(logic murni, bukan form-spesifik) pindah ke
`contents/detail/form/add-edit/helpers/` — dipakai `contents/detail/dialog/edit/`
dan `hooks/use-update-account.ts`.

**`features/accounts/form/` (lokasi LAMA) — HABIS, dihapus total.**
**`features/accounts/dialogs/` (lokasi LAMA) — HABIS, dihapus total.**
`AccountEditDialog` (uncontrolled, trigger pensil sendiri, dipakai
`investment-detail`) — SEMPAT dicoba pindah ke
`contents/detail/dialog/edit/` (digabung dgn controller tab Detail),
LANGSUNG DI-REVERT karena user tegas: itu bikin folder yang seharusnya
khusus "tab Detail halaman Akun" punya tanggung jawab lintas-fitur.
Lokasi FINAL: `features/investment-detail/header/account-edit-dialog.tsx`
(plus `use-account-is-used.ts` duplikat lokal di folder yang sama,
karena lintas fitur juga) — diimpor `investment-detail/header/index.tsx`.

Barrel `features/accounts/index.ts` diperbarui mengikuti semua pemindahan
ini (`AccountForm`/`useCreateAccount`/`useUpdateAccount`/
`defaultAccountValues`/`accountValuesFromEntity` sekarang dari
`./contents/detail/form`).

### 4. `BaseTabs` dipecah jadi 2 komponen (bukan 1 digeneralisasi)

User eksplisit MENOLAK percobaan pertama (menambah props
`value`/`onValueChange` langsung ke `base-tabs.tsx`) DAN percobaan kedua
(masih 1 file, nuqs dibungkus kondisional di dalamnya) — keduanya tetap
mengubah `Props` interface komponen yang sudah established. Solusi
final: `base-tabs.tsx` dikembalikan PERSIS ke bentuk semula, file BARU
terpisah `base-tabs-url.tsx` (`BaseTabsUrl`, pakai `useQueryState`
internal, props `{items, defaultValue, urlParam}`). Dipakai
`AccountsContent`, lalu menular ke `InvestmentsContent` dan
`ThirdPartyContent`.

### 5. `features/investments` ikut dimigrasi `page-layout.md`

`InvestmentsPageContext` (cuma nyimpan `activeTab`) DIHAPUS total,
digantikan `BaseTabsUrl`. `InvestmentsContent` (monolitik, semua logic
tercampur) dipecah jadi 2 section: `content/summary/`
(`InvestmentsSummarySection`, fetch sendiri) dan `content/detail/`
(`InvestmentsDetailSection`, fetch sendiri) — keduanya sama-sama butuh
`useAccounts()`/dll, TIDAK masalah krn react-query dedupe by query key.
Folder `page/` lama dihapus total.

`new-investment-account-dialog.tsx` (uncontrolled, pakai
`AccountForm`/`useCreateAccount` LAMA) ikut dimigrasi ke kontrak baru
SEKALIGUS dengan penggantian barrel `features/accounts/index.ts` (supaya
tidak ada window importer lain pecah).

### 6. `features/third-party` — tab Akun (Read) dibangun, dialog state ganti URL-backed

`content/accounts/list.tsx` (`ThirdPartyAccountList`) — BARU, bukan
refactor. Sengaja TIDAK meniru pola penuh `AccountsDetailSection`
(filter+sort+pagination+accordion) — akun `third_party` biasanya sedikit
(satu per lokasi fisik), jadi cukup `useAccounts()` difilter client-side
`account_type === 'third_party'` + grid card ringkas. Placeholder
"Segera Hadir" di tab Akun diganti komponen ini.

Dialog state kedua tab (`accounts/dialog`, `data/dialog`) diganti dari
`createDialogContext` (local) ke `createDialogQueryContext` (URL-backed)
— konsisten dgn `features/accounts`, walau cuma 1 type `"create"`
(manfaatnya: deep-link/tahan refresh, bukan cuma konsistensi pola).
`ThirdPartyContent` (3 tab) juga diganti `BaseTabs` → `BaseTabsUrl`.

`docs/todos/plan/account-type-third-party.md` ditulis ulang: checklist
dipecah per sub-heading (Konsep & skema / Logic transaksi / Tab Ringkasan
/ Tab Akun CRUD / Tab Data CRUD / Lain-lain), SEMUA penjelasan panjang
dipindah ke section "Detail & rasional keputusan" di paling bawah file
(user eksplisit: "ceklis cukup singkat saja, penjelasan di paling
bawah"). Satu temuan dikonfirmasi selesai: badge tipe akun di
`AccountCard` SUDAH otomatis muncul untuk `third_party` lewat
`ACCOUNT_TYPE_OPTIONS` generik — TIDAK perlu kode tambahan apa pun.

### 7. `features/transactions/form` — mulai dirapikan (BELUM SELESAI)

Urutan kerja disepakati eksplisit dgn user: **field dulu (JSX), baru
logic/hook dalamnya** — kebalikan dari urutan `accounts` (yang hook-nya
duluan). Langkah yang SUDAH selesai:

1. Tombol "Lanjut" (`onSubmitAndContinue`) DIHAPUS dari jalur transaksi
   (user jarang pakai) — dari `form.tsx`, `use-transaction-form.ts`,
   `transaction-create-dialog.tsx`. `useEntityForm` generik TIDAK
   disentuh (dipakai form lain).
2. `schema.ts` → `schema/` folder (pola sama `accounts`): `schema.ts`
   bersih + `values.ts` (`defaultTransactionValues`, HANYA create,
   mode edit tetap bangun sendiri di hook krn terikat entity+race
   condition label) + `index.ts` + `README.md`.
3. 4 hook kecil (`use-transaction-form.ts`, `use-transaction-debt-fields.ts`,
   `use-account-category-options.tsx`, `use-transaction-investment-fields.ts`)
   DIBERSIHKAN komentar inline-nya, dipindah ke `hooks/README.md`
   (section per file, bukan per-file-README terpisah).
4. `use-create-transaction.ts`/`use-update-transaction.ts` (BESAR, 11-16KB)
   — HANYA dipindah jadi subfolder (`use-create-transaction/index.ts`+
   `README.md`, sama utk update) — ISINYA TIDAK DISENTUH SAMA SEKALI,
   masih penuh komentar, masih `useEntityForm`. README masing-masing
   bilang eksplisit "ditunda sampai form.tsx selesai dirapikan".
5. `form.tsx` DIHAPUS, digantikan `components/index.tsx` + 3 field
   independen dipecah (`field-note.tsx`, `field-date.tsx`,
   `field-description.tsx` — HANYA butuh `form` via `useFormContext`,
   dipecah duluan krn paling aman). Field kompleks (`type`, `amount`,
   `account_id`, `transfer_account_id`, `category_id`, `ContactField`,
   `DebtActionField`, `InvestmentFields`) BELUM dipecah — lihat alasan
   di bawah.

**Sempat mencoba generalisasi `BaseForm` menerima `form` eksternal
opsional — DI-REVERT eksplisit oleh user**: "ini jangan diubah, biarkan
seperti awal. Ubah di wrapper transactionnya saja". `base-form.tsx`
dikembalikan PERSIS ke bentuk sebelumnya (hanya dipakai `accounts`).
Solusi final: wrapper BARU khusus transaksi,
`components/transaction-base-form.tsx` (`TransactionBaseForm`) — terima
`form` SUDAH JADI dari luar (dari `useEntityForm`), `FormProvider`
manual, SATU tombol submit (karena tombol "Lanjut" sudah hilang).

## Kenapa field account_id/amount/dll BELUM dipecah (baca sebelum lanjut)

Beda dari `AccountForm` (field cuma butuh `useWatch`/`useFormContext`
murni dari `form.control`), banyak field transaksi butuh data TURUNAN
dari `useTransactionForm()` — gabungan `form.control` + 3 query
(`useAccounts`, `useCategories`, `useContacts`) + 2 hook pendukung
(`useTransactionDebtFields`, `useTransactionInvestmentFields`):
`accountOptions`/`categoryOptions`/`renderAccountOption`,
`debtFieldsLocked`/`needsDebtAction`/`debtStatus`/`involvesDebtAccount`,
`needsInvestmentFields`/`needsInvestmentSellFields`. Field-field ini
TIDAK bisa pakai pola `useFormContext()` murni seperti `FieldAccountName`
— butuh context TAMBAHAN yang membungkus hasil `useTransactionForm()`,
bukan form context RHF biasa.

**Rencana yang sudah disepakati** (BELUM dikerjakan): buat context
terpisah membungkus hasil `useTransactionForm()`, field kompleks
`useContext()` dari situ. BERTAHAP, SATU field per langkah — instruksi
eksplisit user sebelumnya: "perlahan, jangan sekaligus".

## Status kode saat ini

- **`features/accounts`**: migrasi `page-layout.md` + `BaseForm` SELESAI
  penuh. `npx tsc --noEmit -p .` (dari `apps/desktop`) bersih di setiap
  langkah sepanjang sesi.
- **`features/investments`**: migrasi SELESAI, struktur sama
  `accounts` (2 section + `BaseTabsUrl`).
- **`features/third-party`**: tab Akun (Read) SELESAI, dialog state
  URL-backed, dokumen plan diperbarui. Tab Ringkasan & Data (Read/Update/
  Delete) MASIH placeholder — lihat
  `docs/todos/plan/account-type-third-party.md` checklist.
- **`features/transactions`**: form SEDANG dirapikan, BELUM selesai —
  field kompleks belum dipecah, hook mutation belum disentuh sama
  sekali (sengaja ditunda). Lihat bagian berikut.
- TIDAK ada commit sepanjang sesi — SEMUA perubahan di working tree.
  `git status` di root akan menunjukkan file yang jauh lebih banyak
  dari yang terlihat sekilas karena perubahan menyebar ke banyak folder
  (`features/accounts/`, `features/investments/`, `features/third-party/`,
  `features/transactions/`, `components/pattern/`, `components/forms/`,
  `provider/`).

## Gap yang TERSISA untuk sesi berikutnya

1. **Fokus utama: lanjutkan rapi-rapi `features/transactions/form`.**
   Urutan yang disarankan:
   a. Rancang & buat context pembungkus hasil `useTransactionForm()`
      (nama/bentuk pola BELUM difinalkan — diskusikan dgn user dulu,
      jangan asumsi langsung nulis kode).
   b. Pecah SATU field kompleks dulu pakai context itu, verifikasi
      `tsc --noEmit`, baru lanjut field berikutnya — JANGAN sekaligus
      semua.
   c. SETELAH semua field selesai: baru pertimbangkan refactor
      `use-create-transaction`/`use-update-transaction` ke
      `useDbMutation` (lepas `useEntityForm`) — ini urutan yang
      eksplisit diminta user ("field dulu, baru logic & form dari
      dalam"), KEBALIKAN dari urutan `accounts`.
   d. Dialog "buat akun/kategori baru" inline di
      `components/index.tsx` kemungkinan perlu dipecah juga saat field
      `account_id`/`category_id` disentuh — belum dibahas eksplisit.
2. **Tab Ringkasan & Data `features/third-party`** masih placeholder —
   `classifyAccountPair`/`applyThirdPartyTransaction` (logic transaksi)
   jadi blocker sebelum CRUD data bisa jalan beneran. Lihat checklist
   di `docs/todos/plan/account-type-third-party.md`.
3. **`features/accounts/contents/detail/form/add-edit/hooks/use-update-account.ts`**
   dan sejenisnya SUDAH final, tapi belum di-review ulang apakah ada
   komentar inline tersisa yang seharusnya dipindah ke README (hanya
   sebagian file di sesi ini yang eksplisit dibersihkan komentarnya).
4. **Tidak ada test otomatis baru** ditulis sepanjang sesi — verifikasi
   murni `npx tsc --noEmit -p .` berulang kali + 1 kali konfirmasi
   manual user via `tauri dev` (soal tombol "Tambah Akun" yang sempat
   tidak bisa diklik).

## Catatan proses (feedback untuk sesi berikutnya)

- **User menolak generalisasi komponen shared demi 1 kasus baru — DUA
  KALI di sesi ini** (`BaseTabs` lalu `BaseForm`). Pola yang disukai:
  komponen generik yang sudah dipakai banyak tempat TETAP seperti semula,
  kasus baru yang beda bentuk dapat WRAPPER/FILE TERPISAH sendiri. JANGAN
  tambah props opsional ke komponen shared demi mengakomodasi satu
  pemanggil baru — ini pola yang berulang dan kemungkinan akan terus
  berlaku ke depan.
- **Urutan kerja "field dulu, baru logic/hook"** untuk `transactions`
  eksplisit KEBALIKAN dari urutan yang dipakai di `accounts` (di situ
  hook duluan). Jangan asumsikan pola `accounts` otomatis jadi urutan
  baku — user menyesuaikan urutan per fitur berdasarkan di mana letak
  kerumitan terbesarnya (di `transactions`, kerumitan ADA di field/state
  turunan, bukan di hook mutation-nya).
- **"Perlahan, jangan sekaligus"** — instruksi eksplisit untuk migrasi
  field kompleks `transactions`. Pecah SATU per giliran, verifikasi,
  baru lanjut — bukan batch besar seperti yang dilakukan ke field
  `accounts` (yang lebih sederhana, aman dibatch).
- **Checklist dokumen WAJIB singkat, detail di bagian terpisah paling
  bawah** — pola ini diminta eksplisit untuk
  `account-type-third-party.md` dan kemungkinan berlaku untuk dokumen
  todo lain juga (lihat `docs/rules/todo-docs.md` di root yang memang
  sudah mewajibkan ringkasan checklist di atas).
- **Lokasi dokumen session handover**: `docs/handover-session/YYYY-MM/`
  di ROOT monorepo (`financial-app/docs/...`), BUKAN di
  `apps/desktop/docs/todos/`. Sempat ditulis di lokasi salah lalu
  diminta pindah — perhatikan ini untuk sesi berikutnya juga.
