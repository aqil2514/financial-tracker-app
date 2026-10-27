
# Porting Akun (Desktop → Mobile) — INDUK

## Status & TODO saat ini (ringkas)

Dokumen ini INDUK/index — bukan tempat kerja teknis. Tiap tipe akun (`cash`/`debt`/`investment`/`third_party`) punya dokumen todo anak sendiri, fokus ke detail tipenya masing-masing — mengikuti pola yang sudah terbukti bagus di `docs/todos/done/porting-category.md` (satu dokumen fokus, bukan satu dokumen raksasa campur semua hal). Penjelasan lengkap ada di bagian-bagian di bawah.

- [ ] Baca konsep [konsep-tipe-akun.md](../../../../../docs/concept/konsep-tipe-akun.md) — wajib sebelum mengerjakan dokumen anak mana pun, lihat bagian "Latar belakang" di bawah.
- [ ] [porting-account-cash.md](porting-account-cash.md) — tipe **Kas**, satu-satunya tipe yang langsung actionable sekarang (tidak butuh tabel turunan lain). Riset desktop sudah selesai (skema, CRUD, saldo on-the-fly, Balance Correction, field form, pemakaian di form transaksi) — belum ada implementasi, keputusan desain masih perlu diambil.
- [ ] `porting-account-debt.md` — tipe **Utang/Piutang**. **Belum dibuat**, menyusul. Butuh tabel `debts`/`debt_payments`/`contacts` yang belum ada di mobile sama sekali.
- [ ] `porting-account-investment.md` — tipe **Investasi**. **Belum dibuat**, menyusul. Butuh tabel `investment_*` yang belum ada di mobile sama sekali.
- [ ] `porting-account-third-party.md` — tipe **Dana Pihak Ketiga**. **Belum dibuat**, menyusul. Butuh tabel `third_party_funds` yang belum ada di mobile sama sekali.

**Urutan pengerjaan yang masuk akal** (belum final/disepakati eksplisit, tapi mengikuti sebab-akibat yang jelas): `cash` dulu — satu-satunya tipe yang tabel turunannya tidak ada ketergantungan ke fitur lain yang belum diporting. Tipe lain nunggu fitur dasarnya sendiri lebih dulu (debt/investment/third-party masing-masing adalah porting besar sendiri, bukan sekadar "nambah satu tipe di form akun").

## Latar belakang

Ditemukan saat porting Kategori selesai (lihat `docs/todos/done/porting-category.md`) — `transaction-form.tsx` masih punya dua field `FormFieldText` free-text untuk akun (`account_id`, `transfer_account_id`), persis kondisi `category_id` sebelum diporting. Mobile belum punya tabel `accounts`/`account_groups` sama sekali — tidak ada migrasi, tidak ada CRUD, tidak ada dokumen rencana sebelumnya. `porting-category.md` sendiri mencatat Kategori sebagai "tabel referensi **pertama**" yang diporting, mengonfirmasi Akun memang belum pernah disentuh.

**Wajib baca [konsep-tipe-akun.md](../../../../../docs/concept/konsep-tipe-akun.md) sebelum implementasi apa pun di sini** — akun bukan sekadar "dompet", tipe-nya menentukan fitur apa yang relevan, dan dokumen itu eksplisit bilang: *"setiap kali ada ide fitur atau tipe akun baru yang terasa tidak cocok persis dengan pola yang sudah dibahas — wajib didiskusikan dulu sebelum diimplementasikan"*. Baca juga dokumen tipe terkait sebelum mengerjakan anaknya masing-masing: [konsep-utang-piutang.md](../../../../../docs/concept/konsep-utang-piutang.md) untuk `debt`, [konsep-investasi.md](../../../../../docs/concept/konsep-investasi.md) untuk `investment`.

## Kenapa dipecah per tipe, bukan satu dokumen "Porting Akun" besar

Tipe akun bukan sekadar nilai enum di satu kolom — tiap tipe (selain `cash`) membawa tabel turunan sendiri, fitur sendiri, dan keputusan desain sendiri (lihat "Konsekuensi tipe" di konsep-tipe-akun.md). Menyatukan semuanya dalam satu dokumen akan membuatnya seberat/sekompleks `porting-transaction.md` versi awal (yang sendiri sudah menyebut form transaksi sebagai "bagian paling kompleks" karena percabangan income/expense/transfer × cash/debt/investment). Memecah per tipe sejak awal menjaga tiap dokumen tetap fokus dan independen — tipe `cash` bisa dituntaskan penuh tanpa menunggu kejelasan `debt`/`investment`/`third_party`.

## Skema dasar (referensi bersama semua anak, BUKAN untuk di-copy mentah)

Dari `apps/desktop/src-tauri/migrations/0049_account_type_third_party.sql` (versi terakhir tabel `accounts`):

```sql
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    initial_balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    group_id TEXT REFERENCES account_groups(id) ON DELETE SET NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    account_type TEXT NOT NULL DEFAULT 'cash' CHECK (account_type IN ('cash', 'debt', 'investment', 'third_party')),
    color TEXT,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
```

Dari `apps/desktop/src-tauri/migrations/0027_uuid_primary_keys.sql`:

```sql
CREATE TABLE account_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Tabel `accounts` ini **satu tabel dipakai bersama semua tipe** (bukan satu tabel per tipe) — field yang hanya relevan untuk tipe tertentu (mis. field investasi) biasanya tabel terpisah yang `REFERENCES accounts(id)`. Jadi migrasi skema dasar `accounts`/`account_groups` ini kemungkinan jadi bagian dari dokumen anak `cash` (karena itu yang pertama dikerjakan), bukan dokumen induk ini — detail final diputuskan saat anak `cash` ditulis.

## Catatan lintas-tipe yang perlu diperhatikan tiap anak

- `sync_source` — soal sinkronisasi MCP↔desktop, konteksnya spesifik desktop. Belum tentu relevan untuk mobile.
- `deleted_at` — desktop pakai soft delete untuk `accounts` (beda dari `transactions` mobile yang hard delete). Perlu diputuskan eksplisit per konteks mobile, bukan ikut-ikutan karena desktop begitu.
- `icon`/`color` — **beda dari Kategori**: field ini BENAR-BENAR dipakai UI desktop (`FieldIconColor`), bukan kolom mati seperti `categories.icon`. Kalau diporting, pertimbangkan pola picker sungguhan (bukan "emoji nempel di nama" seperti solusi Kategori) — preseden desktop-nya memang field terpisah yang aktif.
- `account_groups` — netral, cuma label pengelompokan bebas (lihat "Grup akun untuk kasus campuran" di konsep-tipe-akun.md). Keputusan ikut porting awal atau menyusul ada di tangan dokumen anak `cash`.
- Tipe akun **terkunci** begitu akun pernah dipakai transaksi (lihat "Mengubah tipe akun yang salah pilih di awal" di konsep-tipe-akun.md) — relevan untuk UI form edit akun di semua anak.
