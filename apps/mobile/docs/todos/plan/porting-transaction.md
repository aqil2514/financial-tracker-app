# Porting Halaman Transaksi (Desktop → Mobile)

## Status & TODO saat ini (ringkas)

Ini masih tahap assessment/riset, belum ada implementasi yang dimulai. Halaman transaksi mobile saat ini kosong total (cuma `PageHeader`), jadi ini bukan "porting" dalam arti pindah kode, melainkan bikin dari nol dengan desktop sebagai referensi fitur dan logic. Penjelasan lengkap tiap poin ada di bagian-bagian di bawah.

- [x] Eksplorasi fitur lengkap halaman transaksi desktop (`apps/desktop/src/features/transactions/`).
- [x] Identifikasi gap: mobile belum punya apa-apa (list, data, form) — lihat bagian Gap Mobile Saat Ini.
- [x] Identifikasi dependency web-only yang butuh pengganti di RN — lihat bagian Dependency & Alternatif RN.
- [ ] Keputusan urutan porting (fase mana duluan) — belum diambil, lihat bagian Rekomendasi Urutan.
- [ ] Keputusan database lokal mobile (`expo-sqlite`) — skema & strategi sync belum dibahas sama sekali.
- [ ] Keputusan pengganti rich-text description (Tiptap tidak ada port RN) — belum ada arah.
- [ ] Keputusan pengganti kalender ringkasan harian (`react-day-picker` web-only) — belum ada arah.
- [ ] Belum ada implementasi kode apapun untuk fitur ini di mobile.

## Latar belakang

Desktop sudah punya halaman transaksi yang matang dan dipakai harian. Mobile masih fase awal (lihat commit history: baru setup NativeWind, header, testing EAS build). Tujuan dokumen ini: memetakan apa yang ada di desktop, apa yang relevan untuk mobile, dan apa yang perlu pendekatan berbeda — sebagai basis diskusi sebelum mulai implementasi bertahap (disepakati tidak akan dikerjakan sekali jalan).

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

### Dependency & alternatif RN

| Kebutuhan | Desktop | Status untuk mobile |
|---|---|---|
| Data fetching/cache | `@tanstack/react-query` v5 | Kompatibel RN, tinggal pakai |
| Form | `react-hook-form` v7 | Kompatibel RN |
| Validasi | `zod` v4 | Kompatibel RN |
| Tanggal | `date-fns` v4 (+ locale `id`) | Kompatibel RN |
| Date picker/kalender | `react-day-picker` v10 (shadcn-style) | Web-only (DOM-based) — perlu `react-native-calendars` atau sejenisnya |
| Rich text description | `@tiptap/react` + `@tiptap/pm` + `@tiptap/starter-kit` v3 | Web-only (contentEditable), tidak ada port RN resmi — perlu turun ke plain text atau editor markdown RN |
| Tabel/list | Tidak ada (list manual + grouped per tanggal) | Portable konsepnya, tinggal `FlatList`/`SectionList` |
| Pagination | Custom `TablePagination`, page/limit klasik | Logic portable, UI dibuat ulang |
| Filter/Sort UI | Custom combobox/select/popover berbasis Radix (shadcn) | Radix web-only, tapi `FilterConfig`/SQL builder portable konsepnya |
| Combobox | Custom, kemungkinan Radix/Base UI | Web-only, perlu bottom-sheet picker RN |
| Database | `@tauri-apps/plugin-sql` (SQLite via Tauri), raw SQL dengan subquery kompleks (`EXISTS`, `GROUP_CONCAT`) | Desktop-only (Tauri) — mobile perlu `expo-sqlite`, driver beda total meski dialect SQLite sama |
| File/attachment | `@tauri-apps/plugin-fs` + `plugin-dialog` + `plugin-clipboard-manager` (drag-drop, paste, file picker ke filesystem lokal) | Tauri-only — mobile perlu `expo-image-picker`/`expo-document-picker`/`expo-file-system`, UX beda total (tidak ada drag-drop/paste desktop) |
| Styling/primitif | Tailwind + shadcn/ui (Radix: Dialog, Tooltip, Popover, ScrollArea, Checkbox) | Web-only — mobile butuh komponen native/RN (misal `react-native-paper`, custom, atau `@gorhom/bottom-sheet`) |

### Kompleksitas

- 113 file, ~5.167 baris khusus di `features/transactions/` — total riil lebih besar (2-3x) kalau dihitung dependency shared yang ikut dipakai (attachments, labels, debts, investments, third-party-funds, contacts, components/query, components/forms, components/rich-text).
- Form punya hierarki hook sampai 4 level: `hooks/create-transaction/{expense,income,transfer}/{cash,debt,investment}.ts` (dan mirror untuk `update-transaction/`) — percabangan domain eksplisit per kombinasi tipe transaksi × tipe akun, bukan satu fungsi besar dengan banyak `if`.
- Context layering 4 level: `TransactionsPageContext` (page) → `ListProvider` (section: filter/data/pagination/lookup) → `TransactionFormFieldsProvider` (form, 9 field saling bergantung) → `CalendarProvider` (calendar panel). Pola ini sudah didokumentasikan di `apps/desktop/docs/rules/state-lifting-vs-context.md` dan `dialog-pattern.md`.
- Ada README internal (`form/add-edit/README.md`) yang mencatat sejarah refactor, bug yang pernah ditemukan, dan hal yang belum pernah diverifikasi — form ini area yang cukup rawan dan sudah melalui beberapa iterasi perbaikan.

**Kesimpulan kompleksitas**: business logic terberat bukan di UI list/filter (itu relatif generik dan portable), tapi di form tambah/edit, karena harus menangani kombinasi income/expense/transfer × cash/debt/investment dengan efek samping ke tabel lain (`debts`, `debt_payments`, `investment_purchases`, `investment_sales`, `third_party_funds`), plus validasi lintas-field dan field locking berdasarkan histori data.

## Gap mobile saat ini

- `apps/mobile/src/app/(tabs)/transactions.tsx` (10 baris) — hanya render `PageHeader` kosong. Tidak ada list, data, atau aksi apapun.
- Komponen pendukung mobile saat ini cuma `apps/mobile/src/components/page-header.tsx` (judul + safe-area inset).
- Halaman lain (`reports.tsx`, `index.tsx`) juga masih skeleton/dummy data.
- Dependency mobile saat ini (`apps/mobile/package.json`): Expo SDK 58, Expo Router, NativeWind, `react-native-chart-kit`, `react-native-reanimated`, `react-native-gesture-handler`. Belum ada `expo-sqlite`, `@tanstack/react-query`, `react-hook-form`, `zod`, `date-fns`, date-picker, atau apapun yang menyentuh database/form/filter.

**Gap fitur**: mobile saat ini = 0% dari fitur transaksi desktop. Bukan versi "lite" yang sudah ada — ini blank slate murni.

## Implikasi porting (observasi, bukan keputusan)

- Bagian yang portable secara konsep (logic SQL, business rules form, Zod schema, React Query hooks) relatif independen dari UI, bisa jadi basis yang sama — tapi driver DB-nya beda total (Tauri SQL plugin vs `expo-sqlite`).
- Bagian paling berat untuk diporting langsung karena web-only: kalender ringkasan harian (`react-day-picker`), rich text description (Tiptap), UI primitif berbasis Radix (Combobox/Dialog/Popover/ScrollArea), dan attachment uploader (drag-drop/paste/file-dialog Tauri) — semua butuh penggantian komponen/pendekatan UX, bukan copy-paste.
- Fitur yang relatif sederhana untuk dibuat versi mobile-nya dari nol (karena tidak terlalu bergantung web API): struktur data filter/sort/pagination, grouping per tanggal, dan skema validasi form.

## Rekomendasi urutan (draft, belum disepakati)

Belum final — perlu didiskusikan lagi sebelum mulai eksekusi. Arah kasar yang masuk akal:

1. Koneksi database lokal mobile (`expo-sqlite`) + skema dasar, read-only dulu.
2. List transaksi dasar: tampil data, grouping per tanggal, tanpa filter/sort dulu.
3. Filter & sort dasar (field yang paling sering dipakai duluan, bukan semua 9 field sekaligus).
4. Pagination atau infinite scroll (perlu diputuskan mana yang lebih natural di mobile — pagination klasik desktop belum tentu cocok di mobile).
5. Form create/edit — bagian paling kompleks, kemungkinan perlu dipecah lagi (misal: cash-only dulu, baru debt, baru investment).
6. Integrasi lanjutan: attachment, label, kalender ringkasan, deep-link edit, Retailku import.

Keputusan desain yang masih menggantung: pengganti Tiptap untuk description, pengganti kalender web untuk ringkasan harian, apakah pagination klasik dipertahankan atau diganti infinite scroll di mobile.
