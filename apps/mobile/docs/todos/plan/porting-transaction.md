# Porting Halaman Transaksi (Desktop → Mobile)

## Status & TODO saat ini (ringkas)

**Dokumen ini ditulis di fase assessment awal (riset murni, belum ada implementasi). Sejak itu, sebagian besar sudah dikerjakan dan berfungsi** — bagian "Gap mobile saat ini", "Dependency & alternatif RN", dan "Rekomendasi urutan" di bawah **masih versi lama/usang** (dipertahankan sebagai arsip riset awal), JANGAN dijadikan rujukan status terkini. Rujukan status terkini ada di checklist ini. Penjelasan lengkap tiap poin ada di bagian-bagian di bawah.

- [x] Eksplorasi fitur lengkap halaman transaksi desktop (`apps/desktop/src/features/transactions/`) — tetap valid sebagai referensi, lihat bagian "Halaman transaksi desktop" di bawah.
- [x] Koneksi database lokal (`expo-sqlite`) + sistem migrasi custom — `apps/mobile/src/lib/database/` (`provider.tsx`, `migrate.ts`, `migrations/`).
- [x] List transaksi — grouped per tanggal (`SectionList`), query SQL nyata (bukan dummy) di `features/transactions/content/index.tsx` & `use-transactions.ts`.
- [x] Filter & sort — 7 dari 9 field desktop (note, description, type, category_id, account_id, amount, has_attachment), sort date/amount — `features/transactions/header/`.
- [x] Form create (`app/transactions/new.tsx`) & edit (`app/transactions/[id]/edit.tsx`) untuk transaksi cash dasar (income/expense/transfer) — delete juga sudah ada di halaman edit.
- [x] Attachment (foto/kamera/dokumen) — `apps/mobile/src/shared/attachments/`, pola pending-save (create) & immediate-save (edit), lihat README-nya.
- [x] Date-time picker native, numpad calculator untuk field amount, deskripsi sebagai plain multiline text (Tiptap desktop TIDAK diporting — keputusan final, bukan placeholder).
- [x] Summary (Pendapatan/Pengeluaran/Total) di atas list — query `SUM()` terpisah (`use-transaction-summary.ts`), ikut filter aktif, independen dari paginasi list nanti.
- [x] Tab Harian/Kalender di halaman Transaksi — selesai. `TransactionTabSwitcher`, `TransactionCalendar` (`react-native-calendars`, custom `CalendarDay`, `use-month-summary.ts`), tap tanggal gabung filter + pindah ke tab Harian. Lihat bagian "Tab Harian & Kalender" di bawah.
- [ ] Pagination/infinite-scroll — belum ada sama sekali, query ambil semua baris tanpa LIMIT/OFFSET. Keputusan "klasik vs infinite scroll" masih benar-benar menggantung.
- [ ] Label — belum ada tabel/kolom label di mobile sama sekali (dikonfirmasi komentar di `header/filter.tsx`).
- [ ] Field debt (`contact_name`, `settle_debt_ids`) & investment (`unit`, `price_per_unit`, `investment_status`) di form — belum dikerjakan, butuh tabel `debts`/`investment_*` yang belum ada di mobile (dikonfirmasi komentar di `form/schema.ts`).
- [ ] Import Retailku — belum dikerjakan, belum dibahas sama sekali.
- [x] `transactions.category_id` sekarang FK ke tabel `categories` (`ON DELETE SET NULL`) — migrasi `0004_transaction_category_fk.ts`, lihat `porting-category.md` (SELESAI) untuk detail lengkap.

## Latar belakang

Desktop sudah punya halaman transaksi yang matang dan dipakai harian. Mobile masih fase awal (lihat commit history: baru setup NativeWind, header, testing EAS build). Tujuan dokumen ini: memetakan apa yang ada di desktop, apa yang relevan untuk mobile, dan apa yang perlu pendekatan berbeda — sebagai basis diskusi sebelum mulai implementasi bertahap (disepakati tidak akan dikerjakan sekali jalan).

## Tab Harian & Kalender

Terinspirasi dari pola app finansial lain (bukan dari desktop — desktop pakai layout 2 kolom tetap, bukan tab), tapi juga menjawab item TODO "Kalender ringkasan harian" yang sejak awal memang tercatat belum dikerjakan di mobile.

### Keputusan yang sudah diambil

- **Scope tab**: hanya "Harian" dan "Kalender" dulu. Referensi punya 5 tab (+ Bulanan, Tutup buku, Memo) tapi itu fitur yang belum ada konsepnya sama sekali di desktop maupun mobile — di luar scope ini, didiskusikan terpisah nanti kalau memang mau dibuat.
- **Tab Harian** = `TransactionList` yang sudah ada, tanpa perubahan logic sama sekali.
- **Tab Kalender**: grid kalender bulanan via `react-native-calendars` (dependency baru), custom day rendering menampilkan ringkasan income/expense singkat per tanggal (perlu query agregasi per-hari untuk bulan yang sedang ditampilkan — mirip konsep `month-summary` di desktop).
- **`TransactionSummary`** (Pendapatan/Pengeluaran/Total) tetap tampil di kedua tab, di atas konten tab — tidak masuk ke dalam salah satu tab saja.
- **Interaksi tap tanggal di Kalender**: filter tanggal (`date` + operator `between`, hari yang sama dari 00:00 sampai 23:59 atau setara) **digabung** dengan filter lain yang mungkin sudah aktif dari panel filter (note/kategori/dst) — bukan mereset filter lain. Field `date` perlu ditambahkan ke `ALLOWED_FILTER_COLUMNS` di `use-transactions.ts` dan `use-transaction-summary.ts` (saat ini belum ada di daftar itu).
- Setelah tap tanggal, **otomatis pindah ke tab Harian** menampilkan transaksi hari itu (list yang sama dipakai ulang, tidak ada komponen list kedua khusus tab Kalender).

### Status: selesai

Semua poin di bagian ini sudah diimplementasikan — lihat checklist status di paling atas dokumen.

## Halaman transaksi desktop (ringkasan eksplorasi)

### Lokasi file

- Route: `apps/desktop/src/app/(app)/transactions/page.tsx` (36 baris, cuma merangkai provider + komponen).
- Feature folder: `apps/desktop/src/features/transactions/` — 113 file, ~5.167 baris (belum termasuk shared code di luar folder ini: attachments, labels, debts, investments, third-party-funds, contacts, yang juga ikut dipakai halaman ini).

### Struktur komponen utama

- `header/index.tsx` — judul + tombol "Tambah Transaksi" (shortcut `N`) + tombol "Ambil dari Retailku".
- `content/index.tsx` — layout 2 kolom: `TransactionList` (kiri) + `TransactionCalendarPanel` (kanan, 420px).
- `content/list/` — list transaksi: context (state filter/sort/pagination/lookup), header (filter, sort), content (grouped-by-date list + item row: info, actions), footer (pagination), use-transactions (query engine SQL).
- `content/calendar/` — panel kalender bulanan dengan ringkasan income/expense per hari.
- `dialog/` — 4 dialog: create, edit, detail, delete-confirm + context generik untuk dialog-state.
- `form/add-edit/` — form terbesar: fields (11 field), hooks create/update (percabangan income/expense/transfer × cash/debt/investment), schema Zod.
- `page/transactions-page-context.tsx` — context level-page untuk `selectedDate`/`dateFilter` dari klik kalender.
- `page/deep-link-edit-dialog.tsx` — buka dialog edit otomatis dari `?edit=<id>` di URL.
- `shared/hooks/*` — delete-transaction, transaction-by-id, transaction-days, month-summary.

### Fitur-fitur

- **Filter** — 9 field: `note` (text), `description` (text), `type` (select), `category_id` (combobox), `account_id` (combobox), `amount` (number + operator), `has_attachment` (select), `label` (combobox by nama label efektif), `source` (select, termasuk hasil import Retailku). Plus `PeriodPicker`/`dateRange` terpisah (butuh `BETWEEN` SQL). Dirender jadi WHERE clause SQL manual.
- **Sort** — dropdown 2 kolom: `date`, `amount`.
- **Pagination** — klasik page/limit (default limit 20), `useState` lokal, bukan URL state.
- **Search** — tidak ada search bar global terpisah; teks dicari lewat filter `note`/`description`.
- **Grouping** — otomatis per tanggal dengan sticky header, menampilkan ringkasan income/expense harian dari data yang tampil.
- **Bulk actions** — tidak ada (tidak ada multi-select/bulk delete/bulk label).
- **Export** — tidak ada tombol export (CSV/PDF).
- **Item list (bukan tabel HTML)** — icon tipe transaksi, catatan, badge kategori, badge label efektif (bisa lebih dari satu), indikator lampiran, indikator deskripsi, baris akun (akun asal → akun tujuan untuk transfer) + badge grup akun, nominal berwarna, running balance (hanya saat di-scope ke 1 akun), jam transaksi.
- **Aksi per-row** — Lihat Detail, Edit, Hapus. Tidak ada "Duplicate" built-in.
- **Form Tambah/Edit** — field: `note` (wajib), `type` (income/expense/transfer), `amount` (nonnegative), `account_id` (wajib), `category_id` atau `transfer_account_id` (mutually exclusive tergantung type), `contact_name` (wajib jika akun terlibat debt, dengan deteksi nama serupa + opsi buat kontak baru inline), `settle_debt_ids[]` (checklist piutang/utang yang dilunasi), `unit`/`price_per_unit`/`investment_status` (field investasi, behavior berbeda untuk beli/jual/write-off/direct-buy), `label_names[]`, `date`, `description` (rich text via Tiptap), `attachments` (upload foto/PDF — drag-drop, paste clipboard, file picker), `source_ref`.
  - Validasi: Zod `superRefine` + validasi silang manual lintas-field, field dikunci/di-disable kondisional (misal field debt yang sudah dicicil terkunci, field kontak di-disable saat transfer debt↔debt).
  - Logic reaktif: auto-set `type` jadi transfer kalau akun sumber bertipe debt; auto-hitung `amount` dari `unit × averageCostPerUnit` saat jual/write-off investasi; auto status `settled` untuk sell/direct-buy.
- **Integrasi fitur lain**:
  - Debt — checklist piutang/utang yang dilunasi, baris `debts`/`debt_payments` otomatis dibuat/diupdate; transfer debt-debt sengaja tidak membuat baris debt (keputusan desain terdokumentasi).
  - Investment — field unit/harga per unit, mode beli/jual/write-off/direct-buy, ringkasan holding.
  - Third-party fund — terhubung lewat `apply-third-party-transaction.ts`, di level hook create/update (bukan field UI standalone). Ingat [[project_investment_account_type_concept]] — jual pending tidak insert transaksi sampai settled.
  - Label — dua-level (eksplisit per transaksi dengan fallback ke label kategori, "effective label" via SQL subquery).
  - Attachment — upload file ke filesystem lokal via Tauri, terhubung ke `transaction_attachments`.
  - Retailku — tombol import/mapping transaksi dari POS eksternal.
  - Kalender — klik tanggal memfilter list, tiap hari tampilkan ringkasan net income/expense (tooltip hover).
  - Deep link edit — dialog edit bisa dibuka dari halaman lain via `?edit=<id>`.
- **URL state (nuqs)** — `nuqs` dipakai di tempat lain di desktop (tabs, account-detail, category-list, dialog-query-state), tapi TIDAK dipakai di halaman transaksi ini. Filter/sort/pagination/dateRange semuanya `useState` biasa (hilang saat refresh). Satu-satunya pemakaian URL murni untuk deep-link `?edit=<id>`.

### Dependency & alternatif RN (ARSIP — prediksi awal, lihat kolom "Realisasi")

> Kolom "Status untuk mobile" adalah prediksi dari riset awal. Kolom "Realisasi" ditambahkan belakangan setelah verifikasi terhadap kode aktual — lihat checklist status di paling atas dokumen untuk detail file.

| Kebutuhan | Desktop | Status untuk mobile (prediksi awal) | Realisasi |
|---|---|---|---|
| Data fetching/cache | `@tanstack/react-query` v5 | Kompatibel RN, tinggal pakai | **Tidak dipakai** — diputuskan pola manual refetch via `useFocusEffect`, tanpa React Query sama sekali. |
| Form | `react-hook-form` v7 | Kompatibel RN | Sesuai prediksi, sudah dipakai (`components/forms/base-form.tsx`). |
| Validasi | `zod` v4 | Kompatibel RN | Sesuai prediksi, sudah dipakai (`form/schema.ts`). |
| Tanggal | `date-fns` v4 (+ locale `id`) | Kompatibel RN | **Tidak dipasang** — util format tanggal custom sendiri (`features/transactions/utils/`), bukan `date-fns`. |
| Date picker/kalender | `react-day-picker` v10 (shadcn-style) | Web-only — perlu `react-native-calendars` atau sejenisnya | **Bukan `react-native-calendars`** — custom `FormFieldDate` (`components/forms/form-fields/form-field-date.tsx`) pakai `@expo/ui`'s `DateTimePicker` native. |
| Rich text description | Tiptap | Web-only — perlu turun ke plain text atau editor markdown RN | **Plain text** (bukan markdown) — `FormFieldText ... multiline`, final diputuskan. |
| Tabel/list | Tidak ada di desktop | Portable, tinggal `FlatList`/`SectionList` | Sesuai prediksi, `SectionList` dipakai (`features/transactions/content/index.tsx`). |
| Pagination | Custom `TablePagination`, page/limit klasik | Logic portable, UI dibuat ulang | **Belum dikerjakan sama sekali** — query ambil semua baris tanpa LIMIT/OFFSET. |
| Filter/Sort UI | Radix (shadcn) | Radix web-only, tapi `FilterConfig`/SQL builder portable | Sesuai prediksi — sudah diimplementasikan penuh (`components/query/filters/`, `components/query/sort/`). |
| Combobox | Custom, Radix/Base UI | Web-only, perlu bottom-sheet picker RN | Sesuai prediksi — `@gorhom/bottom-sheet` dipakai (`components/query/shared/option-picker.tsx`). |
| Database | `@tauri-apps/plugin-sql` | Mobile perlu `expo-sqlite` | Sesuai prediksi, sudah terpasang penuh dengan sistem migrasi custom (`lib/database/`). |
| File/attachment | Tauri plugins (drag-drop, paste, file-dialog) | Mobile perlu `expo-image-picker`/`expo-document-picker`/`expo-file-system` | Sesuai prediksi, sudah diimplementasikan penuh (`shared/attachments/`). |
| Styling/primitif | Tailwind + shadcn/ui (Radix) | Mobile butuh komponen native/RN | **Bukan `react-native-paper`** — custom component + `@gorhom/bottom-sheet`, NativeWind untuk styling. |

### Kompleksitas

- 113 file, ~5.167 baris khusus di `features/transactions/` — total riil lebih besar (2-3x) kalau dihitung dependency shared yang ikut dipakai (attachments, labels, debts, investments, third-party-funds, contacts, components/query, components/forms, components/rich-text).
- Form punya hierarki hook sampai 4 level: `hooks/create-transaction/{expense,income,transfer}/{cash,debt,investment}.ts` (dan mirror untuk `update-transaction/`) — percabangan domain eksplisit per kombinasi tipe transaksi × tipe akun, bukan satu fungsi besar dengan banyak `if`.
- Context layering 4 level: `TransactionsPageContext` (page) → `ListProvider` (section: filter/data/pagination/lookup) → `TransactionFormFieldsProvider` (form, 9 field saling bergantung) → `CalendarProvider` (calendar panel). Pola ini sudah didokumentasikan di `apps/desktop/docs/rules/state-lifting-vs-context.md` dan `dialog-pattern.md`.
- Ada README internal (`form/add-edit/README.md`) yang mencatat sejarah refactor, bug yang pernah ditemukan, dan hal yang belum pernah diverifikasi — form ini area yang cukup rawan dan sudah melalui beberapa iterasi perbaikan.

**Kesimpulan kompleksitas**: business logic terberat bukan di UI list/filter (itu relatif generik dan portable), tapi di form tambah/edit, karena harus menangani kombinasi income/expense/transfer × cash/debt/investment dengan efek samping ke tabel lain (`debts`, `debt_payments`, `investment_purchases`, `investment_sales`, `third_party_funds`), plus validasi lintas-field dan field locking berdasarkan histori data.

## Gap mobile saat ini (ARSIP — ditulis sebelum implementasi dimulai, SUDAH USANG)

> **Catatan verifikasi**: Seluruh bagian ini (termasuk "Implikasi porting" dan "Rekomendasi urutan" di bawahnya) adalah riset dari fase assessment awal, sebelum implementasi apapun dimulai. Hampir semua yang diklaim "belum ada" di sini sekarang SUDAH dikerjakan — lihat checklist status di paling atas dokumen untuk kondisi terkini. Dipertahankan apa adanya sebagai arsip riwayat diskusi (sesuai `docs/rules/todo-docs.md`), BUKAN rujukan status.

- `apps/mobile/src/app/(tabs)/transactions.tsx` (10 baris) — hanya render `PageHeader` kosong. Tidak ada list, data, atau aksi apapun.
- Komponen pendukung mobile saat ini cuma `apps/mobile/src/components/page-header.tsx` (judul + safe-area inset).
- Halaman lain (`reports.tsx`, `index.tsx`) juga masih skeleton/dummy data.
- Dependency mobile saat ini (`apps/mobile/package.json`): Expo SDK 58, Expo Router, NativeWind, `react-native-chart-kit`, `react-native-reanimated`, `react-native-gesture-handler`. Belum ada `expo-sqlite`, `@tanstack/react-query`, `react-hook-form`, `zod`, `date-fns`, date-picker, atau apapun yang menyentuh database/form/filter.

**Gap fitur**: mobile saat ini = 0% dari fitur transaksi desktop. Bukan versi "lite" yang sudah ada — ini blank slate murni.

## Implikasi porting (ARSIP — observasi awal, lihat catatan di atas)

- Bagian yang portable secara konsep (logic SQL, business rules form, Zod schema, React Query hooks) relatif independen dari UI, bisa jadi basis yang sama — tapi driver DB-nya beda total (Tauri SQL plugin vs `expo-sqlite`).
- Bagian paling berat untuk diporting langsung karena web-only: kalender ringkasan harian (`react-day-picker`), rich text description (Tiptap), UI primitif berbasis Radix (Combobox/Dialog/Popover/ScrollArea), dan attachment uploader (drag-drop/paste/file-dialog Tauri) — semua butuh penggantian komponen/pendekatan UX, bukan copy-paste.
- Fitur yang relatif sederhana untuk dibuat versi mobile-nya dari nol (karena tidak terlalu bergantung web API): struktur data filter/sort/pagination, grouping per tanggal, dan skema validasi form.

**Catatan verifikasi**: Prediksi di atas sebagian besar terbukti benar — React Query ternyata TIDAK dipakai (diganti pola manual refetch via `useFocusEffect`), Tiptap diganti plain text (bukan editor markdown), kalender ringkasan harian masih belum dikerjakan sampai sekarang, combobox web diganti bottom-sheet (`@gorhom/bottom-sheet`) sesuai prediksi.

## Rekomendasi urutan (ARSIP — draft awal, lihat catatan di atas)

Belum final — perlu didiskusikan lagi sebelum mulai eksekusi. Arah kasar yang masuk akal:

1. Koneksi database lokal mobile (`expo-sqlite`) + skema dasar, read-only dulu.
2. List transaksi dasar: tampil data, grouping per tanggal, tanpa filter/sort dulu.
3. Filter & sort dasar (field yang paling sering dipakai duluan, bukan semua 9 field sekaligus).
4. Pagination atau infinite scroll (perlu diputuskan mana yang lebih natural di mobile — pagination klasik desktop belum tentu cocok di mobile).
5. Form create/edit — bagian paling kompleks, kemungkinan perlu dipecah lagi (misal: cash-only dulu, baru debt, baru investment).
6. Integrasi lanjutan: attachment, label, kalender ringkasan, deep-link edit, Retailku import.

Keputusan desain yang masih menggantung: pengganti Tiptap untuk description, pengganti kalender web untuk ringkasan harian, apakah pagination klasik dipertahankan atau diganti infinite scroll di mobile.

**Catatan verifikasi**: Urutan 1-3 dan sebagian 5 (cash-only) sudah dieksekusi persis seperti rencana. Urutan 6 baru attachment yang selesai (label, kalender, deep-link, Retailku belum). Urutan 4 (pagination) masih benar-benar belum dikerjakan/diputuskan, sama seperti saat dokumen ini pertama ditulis. "Pengganti Tiptap" sudah final diputuskan (plain text) — lihat checklist status di atas.
