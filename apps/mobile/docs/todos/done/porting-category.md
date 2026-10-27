# Porting Kategori (Desktop → Mobile) — SELESAI

## Status & TODO saat ini (ringkas)

Penjelasan lengkap tiap poin ada di bagian-bagian di bawah.

- [x] Konsep kategori didokumentasikan — [docs/concept/konsep-kategori.md](../../../../../docs/concept/konsep-kategori.md).
- [x] Skema database (migrasi `0003_categories.ts`): `categories`, `category_periods`, `category_period_categories` — lihat bagian Skema.
- [x] Migrasi terdaftar di `migrations/index.ts`, lint bersih.
- [x] Entry point navigasi: menu "Kategori" & "Periode Kategori" di `(tabs)/more.tsx` (grup Master Data), masing-masing route sendiri — lihat bagian Navigasi.
- [x] Halaman create kategori (`categories/new.tsx`) — form lengkap + `INSERT` ke tabel `categories`, sudah fungsional.
- [x] Form kategori (`features/categories/form/`) — schema, default values, komponen form dengan field induk (`parent_id`) yang di-filter sesuai `type` — lihat bagian Form Kategori.
- [x] Halaman list kategori (`categories/index.tsx`) — query sungguhan ke DB, accordion per kategori induk, badge warna by type, filter (search/type/status) via bottom sheet — lihat bagian List Kategori.
- [x] CRUD kategori lanjutan (update, delete, toggle aktif) — selesai. Dot status di list/accordion sudah clickable (toggle `is_active`), halaman `categories/[id]/edit.tsx` untuk update nama/tipe/induk + delete (dengan opsi lepas vs hapus beserta sub-kategori saat kategori induk masih punya anak). Sudah ditest manual.
- [x] UI pemilihan kategori di form transaksi — selesai. `CategoryPickerSheet` (drill-down 2 level, bottom sheet `stackBehavior="push"`) + `FormFieldCategory` ganti `FormFieldText` lama. Sudah ditest manual.
- [x] Pola "buat kategori baru inline dari form transaksi" — selesai. Sheet ke-3 di `CategoryPickerSheet` (`CategoryCreateSheetBody`), bukan navigasi ke `categories/new.tsx`, supaya form transaksi yang sedang diisi tidak ter-unmount. Field dipersingkat: cuma nama (tipe dikunci ke tipe transaksi, induk otomatis dari level sheet yang sedang dibuka — tidak ada field pilih induk, supaya tidak perlu nested sheet ke-4). Tombol "+" muncul di header root sheet maupun child sheet. State nama dipisah ke sub-komponen sendiri supaya tidak memicu re-render berat 3 `BottomSheetModal` tiap keystroke (sempat bikin ngetik cepat kelihatan kacau/ketinggalan huruf — sudah di-fix). Sudah ditest manual.
- [x] FK `transactions.category_id → categories(id)` — selesai. Migrasi `0004_transaction_category_fk.ts` (copy-and-rename, `ON DELETE SET NULL`, konsisten pola desktop). `transaction_attachments` ikut di-rebuild juga karena FK-nya menunjuk ke `transactions` (lihat `apps/desktop/docs/rules/sqlite-copy-and-rename-migration.md` — prinsip sama berlaku di mobile). Data transaksi lama (free-text `category_id`) sudah dihapus manual oleh user sebelum migrasi ini ditulis, jadi tidak perlu backfill. **Penting**: migrasi baru hanya jalan saat app di-restart total (force-close, bukan cukup Fast Refresh) — `onInit` SQLiteProvider cuma jalan sekali saat mount pertama. Setelah migrasi jalan, sempat ketahuan badge kategori di list transaksi nampilin UUID mentah (bukan nama) — sudah di-fix di `use-transactions.ts` (subquery resolve `category_id` → nama, bukan `LEFT JOIN` langsung karena `categories` juga punya kolom `type` yang bentrok dengan filter `transactions.type`). Sudah ditest manual, beres.
- [x] Halaman Periode Kategori + CRUD Category Period — selesai, dikerjakan sekaligus karena satu paket kerja. `features/categories/period/` (schema, form, list, card). List: query `GROUP_CONCAT` nama kategori + `is_ongoing` (`date('now') BETWEEN start_date AND end_date`, badge Berlangsung/Selesai, konsisten pola desktop). Create (`categories/periods/new.tsx`) + edit (`categories/periods/[id]/edit.tsx`, sekalian delete dengan Alert konfirmasi) — update category_ids pakai pola "hapus semua assignment lama lalu insert ulang" (bukan diff granular, junction table-nya kecil). Field multi-select kategori lintas tipe (`CategoryMultiSelectField`) reuse `OptionPicker` mode `multiple` (flat list + search + checkbox, label diberi prefix tipe+induk) — bukan drill-down seperti `CategoryPickerSheet` di form transaksi, karena assign ke periode biasanya pilih beberapa kategori lintas tipe sekaligus, bukan browsing per induk. Tanggal mulai/selesai reuse `FormFieldDate` apa adanya (datetime picker, walau cuma butuh tanggal — keputusan sadar, bukan oversight). CRUD dasar (create, list, edit, delete) sudah ditest manual di device, lancar.
- [x] Aktivasi field `icon` — selesai, tapi beda arah dari rencana awal (bukan picker ikon terpisah). Keputusan: tidak ada field `icon` di UI sama sekali — kolom `icon` di skema database tetap permanen tidak dipakai (sama seperti desktop). Sebagai gantinya, emoji diketik user langsung di depan field "Nama" yang sudah ada (emoji keyboard bawaan OS), mis. nama kategori jadi "🍔 Makanan" — tidak perlu field/komponen/migrasi baru sama sekali. Yang diubah cuma placeholder field Nama (di `category-form.tsx` dan `CategoryCreateSheetBody` quick-create) jadi contoh berisi emoji, supaya user sadar pola ini tersedia.
 
## Latar belakang

Desktop sudah punya fitur kategori matang (CRUD + hierarki 2 level + inline-create dari form transaksi + Category Period untuk ringkasan lintas tipe berdasarkan rentang tanggal). Mobile belum punya tabel referensi/master-data sama sekali — sebelum ini, `transactions.account_id` dan `transactions.category_id` murni teks bebas tanpa tabel rujukan apa pun. Kategori adalah tabel referensi pertama yang diporting ke mobile.

Konsep lengkap (kenapa kategori dipisah per tipe, kenapa transfer tidak punya kategori, apa itu Category Period, dll) ada di [docs/concept/konsep-kategori.md](../../../../../docs/concept/konsep-kategori.md) — dokumen ini fokus ke status porting & keputusan teknis mobile-nya saja, bukan mengulang konsepnya.

## Skema (migrasi `0003_categories.ts`)

```sql
CREATE TABLE categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_categories_parent ON categories(parent_id);

CREATE TABLE category_periods (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE category_period_categories (
  id TEXT PRIMARY KEY NOT NULL,
  period_id TEXT NOT NULL REFERENCES category_periods(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (period_id, category_id)
);
CREATE INDEX idx_category_period_categories_period ON category_period_categories(period_id);
CREATE INDEX idx_category_period_categories_category ON category_period_categories(category_id);
```

File: `apps/mobile/src/lib/database/migrations/0003_categories.ts`.

## Navigasi

Diakses dari tab "Lainnya" (`(tabs)/more.tsx`), grup "Master Data":

- "Kategori" → `/categories` (`app/categories/index.tsx`) — list sungguhan + FAB ke `/categories/new` + tombol Filter di native header.
- "Periode Kategori" → `/categories/periods` (`app/categories/periods/index.tsx`) — list (placeholder) + FAB ke `/categories/periods/new`.

Kedua route berdiri sendiri (bukan tab di satu halaman seperti desktop, lihat bagian Keputusan di bawah soal kenapa).

## Form Kategori

File di `apps/mobile/src/features/categories/form/`:

- `schema.ts` — zod schema `name` (wajib), `type` (`income`/`expense`), `parent_id` (nullable). `icon` dan `is_active` sengaja tidak jadi field form — `icon` belum diaktifkan di UI (lihat bagian Keputusan), `is_active` nanti jadi action toggle di list, bukan field form create/edit.
- `values.ts` — `emptyCategoryValues()`, default `type: "expense"`.
- `category-form.tsx` — komponen form (`BaseForm` + `FormFieldToggleGroup` untuk tipe + `FormFieldText` untuk nama + `ParentCategoryField` untuk induk), pola sama dengan `features/transactions/form/transaction-form.tsx`.
- `fields/parent-category.tsx` — field pemilihan induk, dipisah dari `category-form.tsx` supaya cuma bagian ini yang re-render saat `type` berubah. Penting: komponen ini mengambil instance form lewat `useFormContext()` (disuntik `BaseForm` via `FormProvider`) — **bukan** `useForm()` baru, karena itu akan membuat form terpisah yang tidak terhubung ke form kategori sesungguhnya (bug yang sempat kejadian saat restrukturisasi folder, sudah diperbaiki).
  - Opsi induk: kategori top-level (`parent_id IS NULL`) dengan `type` yang sama, `is_active = 1`, exclude `excludeId` (prop opsional untuk mode edit — kategori tidak boleh jadi induk dirinya sendiri).
  - Ganti `type` otomatis me-reset `parent_id` ke `null` (induk lama tidak valid untuk type baru), tapi di-skip pada render pertama supaya tidak menimpa `parent_id` dari `defaultValues` saat mode edit.

`app/categories/new.tsx` memakai `CategoryForm` ini dan langsung `INSERT INTO categories (id, name, type, parent_id)` — halaman create sudah fungsional. `app/categories/periods/new.tsx` masih placeholder polos (belum ada form Periode).

## List Kategori

File di `apps/mobile/src/features/categories/content/` dan `.../utils/`:

- `use-categories.ts` — `SELECT * FROM categories ORDER BY name`, refetch via `useFocusEffect` (pola sama `use-transactions.ts`, tanpa React Query).
- `utils/group-by-parent.ts` — flat list kategori dikelompokkan jadi `CategorySection[]` per kategori akar (`parent_id IS NULL`): akar dengan anak → section berisi anak-anaknya, akar tanpa anak (flat) → section `isStandalone` berisi dirinya sendiri (tidak expandable). Hierarki cuma 2 level (lihat konsep-kategori.md), jadi tidak ada rekursi lagi di bawah section.
- `category-accordion-section.tsx` — satu section = satu `Pressable` header (dot status + nama + badge tipe berwarna + chevron) + `useState(false)` default **tertutup**, pola sama `MenuGroupSection` di `(tabs)/more.tsx`. Section `isStandalone` tidak punya chevron/isi tersembunyi sama sekali.
- `category-list-item.tsx` — card sub-kategori di dalam section yang expand, dot status + nama + badge tipe. Belum bisa di-tap ke edit (halaman edit belum ada).
- `category-status-dot.tsx` — dot hijau (aktif) / abu (nonaktif), **read-only** — beda dari desktop yang dot-nya clickable buat toggle cepat. Toggle aktif beneran belum dikerjakan.
- `category-list.tsx` — `FlatList` dari `CategorySection[]`, merender `CategoryAccordionSection` per item. Pakai `FlatList` (bukan `SectionList` seperti `TransactionList`) karena tiap section butuh state expand/collapse sendiri, bukan cuma header statis.
- `utils/filter-categories.ts` — filter `search` (nama, substring)/`type` (all/income/expense)/`status` (all/active/inactive), dieksekusi di JS (bukan SQL WHERE). Beda penting dari filter SQL biasa: kalau kategori match, induk/anaknya ikut ditampilkan juga (supaya accordion tidak kelihatan "bolong") — menyamai perilaku grouping filter di desktop (`category-list.tsx` versi desktop juga begitu).
- `category-filter-sheet.tsx` — UI filter-nya `BottomSheetModal` (`snapPoints={["45%"]}`, bukan bar permanen di bawah header) supaya tidak memotong tinggi area list. Dibuka lewat tombol "Filter" (dengan badge jumlah filter aktif) yang dipasang di `headerRight` native Stack header `categories/index.tsx` — bukan `PageHeader` custom seperti halaman di `(tabs)/`, karena halaman ini pakai native header Expo Router (`Stack.Screen options`).

**Badge warna by type** (dipakai section header & item kategori): [components/badge.tsx](../../../src/components/badge.tsx) ditambah prop `variant` (`"neutral"` default | `"income"` | `"expense"`) — emerald untuk income, red untuk expense. Pemakaian lama di `TransactionItem` tidak kasih `variant` sama sekali, otomatis fallback `"neutral"` yang classnya identik dengan sebelum perubahan ini, jadi tidak ada regresi visual di situ.

## Keputusan yang sudah diambil

- **Field `icon` disertakan sejak awal skema** — beda dari desktop (di sana kolomnya ada tapi mati, tidak pernah dipakai UI). Di mobile, niatnya field ini benar-benar diaktifkan nanti (picker ikon `@expo/vector-icons`/Ionicons saat create/edit kategori), bukan kolom mati seperti desktop.
- **Category Period ikut dirancang di migrasi yang sama**, tidak ditunda — alasannya fitur ini sudah aktif dipakai nyata di desktop (bukan eksperimental), jadi tidak ada alasan kuat menunda skemanya meski implementasi UI-nya baru menyusul belakangan.
- **`transactions.category_id` SENGAJA belum diberi FK** ke `categories(id)`. Tabel `transactions` tidak disentuh sama sekali oleh migrasi `0003`. Instruksi eksplisit: "Nanti dulu, setelah kategori sudah matang. tabel transaksi jangan disentuh dulu." FK ini jadi migrasi terpisah nanti, dieksekusi setelah CRUD kategori solid dan form transaksi sudah benar-benar pakai kategori dari tabel (bukan free-text lagi) — supaya tidak ada risiko data `category_id` yang sudah terlanjur free-text jadi melanggar constraint begitu FK dipasang.
- **Satu file migrasi untuk ketiga tabel** (`categories` + `category_periods` + `category_period_categories`), bukan dipecah per tabel — dianggap satu kesatuan konsep yang didiskusikan bersamaan, mengikuti pola migrasi `0002` yang juga gabungan (pragma + attachments).
- **Tidak akan pakai React Query** untuk CRUD kategori — ini bukan keputusan baru, tapi warisan pola yang sudah berlaku di fitur transaksi (`use-transactions.ts`): mobile sengaja tidak memasang `@tanstack/react-query` sama sekali, memakai pola manual refetch via `useFocusEffect` + `useState` lokal (lihat verifikasi di `porting-transaction.md`). CRUD kategori nanti mengikuti pola yang sama, bukan kesempatan untuk mulai pasang React Query.
- **Kategori dan Category Period jadi dua halaman terpisah**, bukan tab di satu halaman seperti desktop (`CategoryContent` dengan tab "Daftar Kategori"/"Periode"). Alasan: tab "Harian"/"Kalender" di halaman Transaksi mobile itu dua tampilan dari data yang sama (satu CRUD transaksi) — cocok jadi tab. Kategori dan Category Period masing-masing punya CRUD sendiri yang independen, jadi dipisah jadi route sendiri (`/categories` dan `/categories/periods`) lebih jujur secara arsitektur, bukan dipaksa jadi satu halaman dengan dua tab.
- **List kategori pakai accordion (default tertutup), bukan grid+accordion seperti desktop.** Desktop render kategori induk+anak sebagai accordion dengan grid card untuk anaknya (dan expand semua by default). Mobile disederhanakan jadi satu pola: tiap kategori induk adalah satu accordion section (tertutup di awal), isinya daftar vertikal sub-kategori — lebih hemat ruang layar kecil dan tidak perlu grid responsif.
- **Filter kategori di JS, bukan reuse `FilterPanel` generic SQL-WHERE yang dipakai Transaksi.** Alasan: search yang match induk harus tetap menampilkan semua anaknya (dan sebaliknya) supaya accordion tidak kelihatan bolong tanpa alasan jelas — `FilterPanel` filter per-baris lewat SQL WHERE tidak bisa menjaga relasi induk-anak seperti itu. Trade-off: filter kategori tidak reuse infrastruktur query generic yang sudah ada, jadi kalau kriteria filter makin kompleks nanti, pertimbangkan ulang apakah tetap worth it custom atau migrasi ke `FilterPanel`.
- **Filter kategori ditaruh di bottom sheet (tombol "Filter" di header), bukan bar filter permanen di bawah header.** Bar permanen memotong tinggi area list; sheet (`snapPoints={["45%"]}`) dibuka on-demand lewat tombol di `headerRight`, konsisten dengan pola tombol+sheet filter Transaksi (`FilterPanel`) walau implementasi isinya beda (lihat poin di atas).

## Keputusan yang sebelumnya belum diambil — sudah terjawab

Semua ini sudah diputuskan & diimplementasikan, dicatat di sini sebagai riwayat:

- Bentuk UI "pilih kategori" di form transaksi → `CategoryPickerSheet`, searchable bottom sheet drill-down 2 level (bukan dropdown biasa).
- Bentuk UI "buat kategori baru inline dari form transaksi" → dikerjakan, sheet ke-3 di `CategoryPickerSheet` (bukan navigasi halaman terpisah).
- Urutan pengerjaan → interleaved: CRUD kategori dasar → picker di form transaksi → inline-create → FK → Category Period → aktivasi `icon`, bukan satu fitur dituntaskan penuh baru pindah ke fitur berikutnya.
- Category Period → dikerjakan segera (bukan ditunda), sekaligus list+create+edit+delete dalam satu putaran kerja.
