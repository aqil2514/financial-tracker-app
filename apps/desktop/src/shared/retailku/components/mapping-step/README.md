# `mapping-step`

Step 2 dialog picker Retailku — menggantikan SELURUH isi dialog (bukan ditambah di bawah `left-side`/`right-side`), dipicu tombol "Pakai Data Ini" di `../right-side/`. Satu item Retailku bisa menghasilkan beberapa entri (`tool.toPackage(detail)`, lihat `../../registry/`), tiap entri jadi satu tab dengan form sungguhan yang bisa diedit — bukan preview read-only.

## `index.tsx`

`MappingStep` — orchestrator. Ambil `detailRaw` lewat query yang SAMA dengan `../right-side/index.tsx` (key identik, React Query dedupe — bukan fetch ulang), panggil `tool.toPackage(detailRaw)` untuk dapat daftar entri, render satu `Tabs`/`TabsTrigger`/`TabsContent` per entri.

Tiap tab TIDAK punya tombol submit sendiri — form di dalamnya melapor nilai terbarunya ke `results` (state lokal di sini) lewat `onChange`. Tombol "Simpan Semua" di footer aktif hanya kalau SEMUA entri yang TIDAK dikecualikan (`excludedIds`, lihat di bawah) sudah valid (`results[entry.id] != null`), memanggil `useSavePackage`.

Tiap tab juga punya tombol "Jangan Simpan"/"Simpan Lagi" (`excludedIds: Set<string>`, state lokal) untuk mengecualikan satu entri dari "Simpan Semua" tanpa membatalkan seluruh picker — berguna kalau satu item Retailku menghasilkan beberapa entri (mis. Cash Opname dengan beberapa dana pihak ketiga) tapi user cuma mau simpan sebagian. Entri yang dikecualikan: form-nya TIDAK dirender (`isExcluded ? null : ...`, jadi ikut ter-unmount, `useForm` dalamnya reset total) dan label tabnya dicoret (`line-through`) — tapi tab itu sendiri TETAP ada di `TabsList` (bukan dihapus dari render) supaya user bisa toggle balik ("Simpan Lagi") dan form-nya remount dari `defaultValues` semula. Hitungan `(${includedEntries.length})` di tombol "Simpan Semua" cuma menghitung entri yang tidak dikecualikan.

Sengaja TIDAK pakai `@/components/pattern/array-field-tabs` (`ArrayFieldTabs`) — komponen itu didesain untuk navigasi dikontrol dari panel overview terpisah (lihat pemakaiannya di `features/retailku/mapping/`), sedangkan di sini jumlah entri kecil (biasanya 1-5) dan cukup `TabsList` biasa.

## `third-party-fund-entry-form.tsx`, `transaction-entry-form.tsx`

Versi field form Dana Pihak Ketiga / Transaksi TANPA `<form>` tag dan tombol submit sendiri — field-fieldnya SAMA PERSIS dengan form asli (`features/third-party/.../form/index.tsx`, `features/transactions/.../transaction-form-with-base-form.tsx`), cuma dilepas dari bungkus `BaseForm`/`DialogFooter` supaya bisa hidup di dalam satu tab tanpa tombol submit ganda.

Pola: `useForm` sendiri per tab, `useWatch` seluruh value, lapor ke parent lewat `onChange` tiap berubah (`thirdPartyFundSchema`/`transactionSchema` `.safeParse` — valid → objek output, invalid → `null`, dipakai `MappingStep` buat tahu kapan tab ini "siap disimpan"). Pola yang sama dengan `useGenericMappingForm` (`features/retailku/mapping/form/generic/`, fitur sync lama).

`TransactionEntryForm` WAJIB membungkus field-nya dengan DUA provider sekaligus: `FormProvider` (react-hook-form, dibutuhkan field "sederhana" seperti `FieldNote`/`FieldDate` yang baca `useFormContext()`) DAN `TransactionFormFieldsProvider` (context custom, dibutuhkan field "kompleks" seperti `FieldAccountId`/`FieldDebtAction` yang baca `useTransactionFormFields()`) — field-field itu sendiri tidak diubah, cuma sumber context-nya dua jalur berbeda (lihat `features/transactions/form/add-edit/README.md`). `onSubmit`/`handleSubmitRef` yang diwajibkan `TransactionFormFieldsProvider` diisi no-op — tidak pernah benar-benar terpanggil karena tidak ada elemen `<form>`/tombol submit di tab ini.

`TransactionEntryForm` menyertakan `FieldDescription` (2026-10-24, ditambahkan supaya breakdown rich text dari `registry/get-purchase-order.ts`/`get-direct-purchase.ts` — bullet list per item + "Total Belanja" — bisa terlihat/diedit) tapi TIDAK `FieldAttachments` — prefill dari Retailku tidak pernah membawa lampiran file.

## `use-save-package.ts`

`useSavePackage` — mutation "Simpan Semua". Tiap entri di-insert BERURUTAN (bukan `Promise.all`): `target: "transaction"` lewat `createTransaction` (`features/transactions/.../create-transaction/`), `target: "third-party-fund"` lewat `createDirectThirdPartyFund` (`shared/third-party-funds/`, diekstrak dari `use-create-third-party-fund.ts` supaya bisa dipanggil programatik di luar hook form) — keduanya fungsi murni `(values) => Promise<string>`, tidak ada duplikasi logic insert.

Berurutan (bukan paralel) supaya kalau satu entri gagal di tengah, sisanya tidak ikut lanjut sembarangan dan toast error jelas menunjuk mutation yang berhenti — entri SEBELUM yang gagal tetap tersimpan (TIDAK di-rollback), konsisten dengan pola non-transactional multi-insert lain di proyek ini (mis. `applyDirectThirdPartyTransaction` yang validasi oversell SEBELUM insert, bukan sesudah, demi alasan yang sama).

`onDone` dipanggil setelah sukses — `MappingStep` memakainya untuk `closeDialog()` (dari `useRetailkuDialog`, context dialog luar), BUKAN `goToBrowseStep` (context lokal) — menutup dialog sepenuhnya, bukan kembali ke step 1.
