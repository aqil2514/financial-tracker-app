# Porting Kategori (Desktop → Mobile)

## Status & TODO saat ini (ringkas)

Penjelasan lengkap tiap poin ada di bagian-bagian di bawah.

- [x] Konsep kategori didokumentasikan — [docs/concept/konsep-kategori.md](../../../../../docs/concept/konsep-kategori.md).
- [x] Skema database (migrasi `0003_categories.ts`): `categories`, `category_periods`, `category_period_categories` — lihat bagian Skema.
- [x] Migrasi terdaftar di `migrations/index.ts`, lint bersih.
- [ ] CRUD kategori dasar (list, create, update, delete, toggle aktif) — belum dimulai.
- [ ] UI pemilihan kategori di form transaksi (sekarang masih `FormFieldText` free-text) — belum dimulai.
- [ ] Pola "buat kategori baru inline dari form transaksi" (seperti combobox desktop) — belum diputuskan bentuk UI mobile-nya (kandidat: bottom sheet + search, mengikuti pola `AttachmentSourceSheet`).
- [ ] FK `transactions.category_id → categories(id)` — sengaja ditunda, lihat bagian Keputusan.
- [ ] CRUD Category Period (list, create, update, delete periode + assign kategori) — belum dimulai.
- [ ] Report/ringkasan Category Period (agregasi on-the-fly dari `transactions`) — belum dimulai, dan bergantung ke FK `category_id` yang juga belum ada.
- [ ] Aktivasi field `icon` di UI (picker ikon saat create/edit kategori) — belum dimulai.

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

## Keputusan yang sudah diambil

- **Field `icon` disertakan sejak awal skema** — beda dari desktop (di sana kolomnya ada tapi mati, tidak pernah dipakai UI). Di mobile, niatnya field ini benar-benar diaktifkan nanti (picker ikon `@expo/vector-icons`/Ionicons saat create/edit kategori), bukan kolom mati seperti desktop.
- **Category Period ikut dirancang di migrasi yang sama**, tidak ditunda — alasannya fitur ini sudah aktif dipakai nyata di desktop (bukan eksperimental), jadi tidak ada alasan kuat menunda skemanya meski implementasi UI-nya baru menyusul belakangan.
- **`transactions.category_id` SENGAJA belum diberi FK** ke `categories(id)`. Tabel `transactions` tidak disentuh sama sekali oleh migrasi `0003`. Instruksi eksplisit: "Nanti dulu, setelah kategori sudah matang. tabel transaksi jangan disentuh dulu." FK ini jadi migrasi terpisah nanti, dieksekusi setelah CRUD kategori solid dan form transaksi sudah benar-benar pakai kategori dari tabel (bukan free-text lagi) — supaya tidak ada risiko data `category_id` yang sudah terlanjur free-text jadi melanggar constraint begitu FK dipasang.
- **Satu file migrasi untuk ketiga tabel** (`categories` + `category_periods` + `category_period_categories`), bukan dipecah per tabel — dianggap satu kesatuan konsep yang didiskusikan bersamaan, mengikuti pola migrasi `0002` yang juga gabungan (pragma + attachments).
- **Tidak akan pakai React Query** untuk CRUD kategori — ini bukan keputusan baru, tapi warisan pola yang sudah berlaku di fitur transaksi (`use-transactions.ts`): mobile sengaja tidak memasang `@tanstack/react-query` sama sekali, memakai pola manual refetch via `useFocusEffect` + `useState` lokal (lihat verifikasi di `porting-transaction.md`). CRUD kategori nanti mengikuti pola yang sama, bukan kesempatan untuk mulai pasang React Query.

## Keputusan yang BELUM diambil

- Bentuk UI "pilih kategori" di form transaksi — dropdown/picker biasa dulu, atau langsung searchable bottom sheet seperti pola `AttachmentSourceSheet`?
- Bentuk UI "buat kategori baru inline dari form transaksi" — apakah perlu di porting awal, atau CRUD kategori mandiri (halaman terpisah) dulu sampai solid, baru inline-create menyusul?
- Urutan pengerjaan: CRUD kategori dasar dulu sampai selesai, baru pemakaiannya di form transaksi — atau dikerjakan paralel/interleaved?
- Apakah Category Period dikerjakan segera setelah kategori dasar selesai, atau ditunda sampai ada kebutuhan nyata dari pemakaian mobile (mengingat laporan/ringkasannya baru bisa jalan penuh setelah FK `category_id` terpasang)?
