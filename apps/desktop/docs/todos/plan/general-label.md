# Label General Lintas Tabel

## Status & TODO saat ini (ringkas)

Penjelasan lengkap kenapa tiap poin ada di sini — lihat bagian "Latar belakang" dan "Keputusan desain" di bawah.

- [x] Riset awal: dipastikan belum ada mekanisme serupa (bukan `account_groups`, bukan kolom `type` di `categories`) — lihat "Kenapa bukan yang sudah ada".
- [x] Keputusan: many-to-many (satu baris bisa punya lebih dari satu label), bukan kolom FK tunggal seperti `group_id`.
- [x] Keputusan: scope ganda — label bisa ditempel di `categories` DAN `transactions` DAN `accounts`, bukan cuma satu tabel.
- [x] Keputusan: resolusi "nilai efektif" transaksi vs kategori pakai fallback per-scope (transaksi menang kalau ada, kategori jadi default kalau transaksi kosong di scope itu) — murni di lapisan query, BUKAN kolom tersimpan.
- [x] Keputusan: cakupan fitur HANYA query/filter/agregasi tampilan — TIDAK ada logic bisnis (balance, P&L, validasi) yang bergantung ke label apa pun.
- [ ] Keputusan belum diambil: apakah fallback kategori→transaksi ini butuh kolom "urutan prioritas" kalau nanti kategori py >1 label di scope yang sama, atau dibatasi 1 label per scope per baris (lihat "Pertanyaan terbuka").
- [ ] Desain skema final (nama tabel, kolom `scope`, index) — draf ada di bawah, belum final.
- [ ] Migrasi SQL belum ditulis.
- [ ] UI pemilihan/pengelolaan label (CRUD label, attach/detach ke transaksi/kategori/akun) belum didesain.
- [ ] Query helper (fallback kategori→transaksi, filter laporan per label) belum ditulis.
- [ ] Sinkronisasi ke `apps/worker`/`apps/mcp-server` belum dibahas sama sekali — belum diputuskan apakah label ikut disync atau desktop-only (lihat pola investasi yang sempat desktop-only dulu sebelum menyusul).

## Latar belakang

Diskusi dimulai dari dua kebutuhan konkret yang muncul terpisah, lalu ternyata sama bentuknya:

1. **Konsumtif vs Produktif** — saat ini tidak ada cara membedakan transaksi expense yang sifatnya konsumtif (habis pakai, tidak menghasilkan balik — makan, hiburan) dari yang produktif (modal kerja, alat produksi, investasi ke aset yang menghasilkan).
2. **Jenis instrumen investasi** — akun bertipe `investment` saat ini tidak punya field jenis instrumen (RDPU, Obligasi, SBN Ritel, Deposito, Saham, Kripto, dst). Satu-satunya pembeda sekarang murni nama akun yang diketik bebas, tidak terstruktur, tidak bisa difilter/diagregasi per jenis.

Keduanya sama-sama butuh "dimensi klasifikasi tambahan" yang TIDAK mempengaruhi kalkulasi/validasi apa pun — murni label untuk query/filter/laporan. Daripada bikin kolom enum terpisah untuk tiap kebutuhan (yang akan terus bertambah — besok mungkin "level risiko", "tujuan keuangan", dst), diputuskan membuat satu mekanisme **label generik lintas tabel**, dipakai bersama oleh kasus manapun yang muncul nanti.

## Kenapa bukan yang sudah ada

- **`account_groups`** — sudah jadi bentuk "label" untuk akun, tapi one-to-many (kolom `group_id` langsung di `accounts`, satu akun cuma satu grup) dan khusus akun saja. Tidak cukup untuk kebutuhan many-to-many lintas tabel.
- **`categories.type`** — cuma `income`/`expense`, bukan dimensi klasifikasi tambahan, dan tidak lintas tabel.
- Tidak ada tabel/kolom lain di skema saat ini yang menyerupai mekanisme label generik (sudah dicek lewat `.schema` ke seluruh 15 tabel yang ada).

## Keputusan desain

### Sifat: netral, presentasi, query-only

Label ini **murni untuk klasifikasi/filter/query GET** — sama sekali TIDAK mempengaruhi kalkulasi `balance`, Unrealized/Realized P/L, validasi form, atau logic bisnis apa pun. Ini beda sifat dari `account_type` (murni teknis, menentukan fitur/field apa yang tersedia, lihat `docs/concept/konsep-tipe-akun.md`) — label lebih dekat ke sifat `account_groups` (netral, bebas, pilihan user), tapi digeneralisasi lintas tabel dan many-to-many.

Konsekuensi: tidak perlu trigger, tidak perlu kolom turunan tersimpan, tidak perlu masuk ke `applyInvestmentTransaction`/`applyDebtTransaction` atau fungsi `apply*` manapun. Implementasinya murni CRUD label + tabel relasi + query helper untuk laporan/filter.

### Many-to-many, bukan kolom FK tunggal

Satu transaksi/kategori/akun bisa punya LEBIH DARI SATU label sekaligus (mis. satu akun investasi bisa berlabel "RDPU" dan juga "Dana Darurat" sekaligus — dua dimensi label berbeda). Ini beda dari `group_id` yang cuma satu nilai per akun. Konsekuensi: butuh tabel junction (many-to-many), bukan kolom `label_id` nullable biasa.

### Tabel master bersama + junction table per tabel target (bukan polymorphic)

Proyek ini konsisten menjaga FK ketat (lihat pola copy-and-rename demi `CHECK`/FK di migrasi manapun yang mengubah skema terkait relasi — tidak pernah pakai referential integrity longgar). Karena itu, desainnya:

- **Satu tabel `labels`** (master/dictionary) — dipakai bersama lintas tabel, BUKAN satu tabel label per tabel target.
- **Junction table TERPISAH per tabel target** (`transaction_labels`, `category_labels`, `account_labels`) — masing-masing dengan FK sungguhan ke tabelnya + `ON DELETE CASCADE` yang proper. BUKAN satu junction polymorphic (`entity_type` + `entity_id` generik tanpa FK), yang akan kehilangan referential integrity dan constraint checking yang sudah jadi kebiasaan proyek ini.

Pertimbangan array/JSON di satu kolom (`TEXT` berisi `["produktif","rdpu"]`) juga sempat dibahas dan DITOLAK — alasan: FK integrity hilang (hapus label dari master tidak otomatis bersih di baris yang menyebutnya), query jadi lebih mahal (`json_each()` dibanding `JOIN` biasa + index), dan rename/dedupe label jadi sulit (harus update semua baris yang menyebut string itu, bukan cukup 1 baris di tabel master).

### `scope` di tabel `labels`

Supaya dropdown pemilihan label tidak tercampur lintas konteks yang tidak relevan (mis. "Produktif" muncul juga saat melabeli akun investasi dengan jenis instrumen), `labels` punya kolom `scope` yang menandai label ini dibuat untuk konteks tabel target yang mana.

**Catatan penting**: `scope` ini melengkapi, BUKAN menggantikan junction table — `scope` menjawab "label apa saja yang valid dipilih di konteks ini", sedangkan junction table menjawab "baris mana terhubung ke label mana". Keduanya dibutuhkan bersama, satu tidak bisa menggantikan yang lain (sempat didiskusikan eksplisit karena awalnya terlihat seperti alternatif satu sama lain).

### Dua pola beda untuk dua use-case asal (konsumtif/produktif vs jenis instrumen)

Diskusi eksplisit menyimpulkan BUKAN satu aturan berlaku sama untuk semua label — tergantung sifat labelnya:

- **Label yang melekat ke "jenis/pola" (Konsumtif/Produktif)** → ditempel di `categories` (default/mayoritas kasus, karena kategori "Makan" hampir selalu konsumtif) DAN di `transactions` (override pengecualian per-baris, karena kategori yang sama bisa ambigu tergantung konteks — mis. "Elektronik" buat pribadi vs buat alat kerja). Dibutuhkan KEDUANYA, bukan pilih salah satu — kategori sendirian tidak bisa menangani pengecualian, transaksi sendirian berarti user harus melabeli ribuan baris manual padahal polanya sudah jelas dari kategori.
- **Label yang melekat ke entitas tunggal yang tidak pernah berubah (jenis instrumen investasi)** → cukup ditempel di `accounts` saja. Satu akun investasi = satu instrumen (prinsip yang sudah mapan di `docs/concept/konsep-investasi.md`) — sekali dilabeli "RDPU", seluruh histori pembelian/penjualan di akun itu tidak pernah berubah jenis instrumennya. Tidak masuk akal ditempel di kategori atau per-transaksi.

### Resolusi nilai efektif: fallback per-scope, bukan override paksa

Kalau transaksi tidak dilabeli secara eksplisit di suatu scope, label dari KATEGORINYA dipakai sebagai fallback saat query/laporan (bukan akun — sempat salah sebut akun di tengah diskusi, dikoreksi ke kategori). Ini FALLBACK (default kalau kosong), BUKAN override paksa (transaksi yang SUDAH py label eksplisit di scope itu tidak pernah ditimpa oleh kategori).

Urutan resolusi per-scope:
1. Transaksi punya label di scope ini? → pakai itu.
2. Transaksi tidak punya label di scope ini, tapi py `category_id` dan kategorinya punya label di scope ini? → pakai label kategori.
3. Keduanya kosong (termasuk transaksi `category_id IS NULL`, dikonfirmasi BISA terjadi — 6 expense, 15 income, 2161 transfer saat ini tidak punya kategori di `finance.dev.db`) → tidak berlabel di scope itu, BUKAN error.

Fallback ini per-scope independen, BUKAN all-or-nothing per baris transaksi — kalau transaksi py label di scope "sifat-ekonomi" tapi kosong di scope lain, cuma scope yang kosong itu yang fallback ke kategori.

Resolusi ini murni logic query (`LEFT JOIN` + `COALESCE` dengan prioritas transaksi dulu), BUKAN kolom tersimpan atau trigger — konsisten dengan sifat "query-only" di atas.

## Draf skema (belum final)

```sql
CREATE TABLE labels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('transaction', 'account')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (name, scope)
);

CREATE TABLE transaction_labels (
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (transaction_id, label_id)
);

CREATE TABLE category_labels (
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (category_id, label_id)
);

CREATE TABLE account_labels (
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (account_id, label_id)
);
```

Catatan: `scope` pada draf di atas baru 2 nilai (`transaction`, `account`) karena `transaction_labels` dan `category_labels` sebenarnya berbagi scope yang sama (label "Konsumtif/Produktif" dipakai di dua tabel itu sekaligus) — BELUM diputuskan apakah ini berarti `category_labels` tidak butuh `scope` filter terpisah, atau perlu nilai scope ketiga. Lihat "Pertanyaan terbuka".

## Pertanyaan terbuka (belum diputuskan)

- Apakah satu kategori/transaksi bisa punya LEBIH DARI SATU label DALAM scope yang sama (mis. dua label "Konsumtif" dan "Produktif" sekaligus di satu baris)? Kalau tidak boleh (mutually exclusive dalam satu scope), perlu constraint tambahan (unique partial index atau validasi di aplikasi) untuk mencegahnya — tabel di atas secara skema MENGIZINKAN itu terjadi.
- Kalau mutually exclusive per-scope dan kategori py label konflik dengan transaksi (jarang, tapi mungkin lewat bug data), apakah fallback tetap jalan atau butuh resolusi tambahan? (Catatan: ini beda dari "konflik akun vs transaksi" yang sempat dibahas di awal lalu dikoreksi ke kategori — pertanyaan di sini murni soal multiplisitas label dalam satu scope, bukan soal akun.)
- Apakah label perlu disinkronkan ke `apps/worker`/`apps/mcp-server`, atau cukup desktop-only dulu (pola yang sempat terjadi di investasi sebelum di-port menyusul, lihat `docs/todos/plan/investment-sync.md`)?
- Apakah UI pemilihan label berupa multi-select combobox biasa, atau butuh pattern lain (chip input, dst)?
- Siapa yang boleh membuat label baru — bebas dari form transaksi/kategori/akun langsung (seperti kontak baru bisa dibuat inline), atau cuma lewat halaman manajemen label terpisah?
