# Label General Lintas Tabel

## Status & TODO saat ini (ringkas)

Penjelasan lengkap kenapa tiap poin ada di sini — lihat bagian "Latar belakang" dan "Keputusan desain" di bawah.

- [x] Riset awal: dipastikan belum ada mekanisme serupa (bukan `account_groups`, bukan kolom `type` di `categories`) — lihat "Kenapa bukan yang sudah ada".
- [x] Keputusan: many-to-many (satu baris bisa punya lebih dari satu label), bukan kolom FK tunggal seperti `group_id`.
- [x] Keputusan: scope ganda — label bisa ditempel di `categories` DAN `transactions` DAN `accounts`, bukan cuma satu tabel.
- [x] Keputusan: resolusi "nilai efektif" transaksi vs kategori pakai fallback per-scope (transaksi menang kalau ada, kategori jadi default kalau transaksi kosong di scope itu) — murni di lapisan query, BUKAN kolom tersimpan.
- [x] Keputusan: cakupan fitur HANYA query/filter/agregasi tampilan — TIDAK ada logic bisnis (balance, P&L, validasi) yang bergantung ke label apa pun.
- [x] Keputusan: satu baris BOLEH punya lebih dari satu label dalam scope yang sama (mis. "Konsumtif" + "Produktif" bersamaan) — tidak mutually exclusive, tidak ada constraint yang mencegahnya. Kalau tampak "bentrok" secara makna, itu tanggung jawab user saat memilih label, bukan sesuatu yang divalidasi/dicegah aplikasi.
- [x] Keputusan: disync ke `apps/worker` (D1) & `apps/mcp-server` SEJAK AWAL, bukan desktop-only dulu — skema/migrasi didesain langsung kompatibel dengan worker, dan tool MCP untuk CRUD/attach-detach label dibuat bersamaan dengan fitur desktop-nya.
- [x] Keputusan: UI pemilihan label pakai multi-select combobox biasa (konsisten dengan pattern form lain di aplikasi), bukan chip/tag input.
- [x] Keputusan: label baru bisa dibuat inline langsung dari form transaksi/kategori/akun (sama seperti kontak baru) — tidak perlu halaman manajemen label terpisah untuk membuat label.
- [x] Desain skema final (nama tabel, kolom `scope`, index, pola sync) — lihat "Draf skema" di bawah, final. Opsi gabung `transaction_labels`+`category_labels` jadi polymorphic dipertimbangkan ulang & ditolak — tetap FK ketat, 3 junction table terpisah (lihat catatan di "Tabel master bersama...").
- [x] Desain endpoint Worker & tool MCP — CRUD full, pola persis modul `attachments`, lihat "Rencana endpoint Worker & tool MCP" di bawah.
- [x] Migrasi SQL ditulis & diterapkan — desktop (`0045_labels.sql`, `0046_cloud_sync_queue_labels.sql`, teregistrasi di `migrations.rs`) dan `apps/worker/schema/0005_labels.sql` (sudah diverifikasi jalan bersih di D1 lokal via `wrangler d1 execute --local`).
- [x] Implementasi controller/service Worker (`apps/worker/src/modules/labels/`) — ditulis & diverifikasi end-to-end lewat `wrangler dev --local` + curl (CRUD label, attach/detach/list multi-label, validasi 404).
- [x] Implementasi tool MCP (`apps/mcp-server/src/lib/mcp-tools/labels/`) — 7 tool (`create_label`, `list_labels`, `update_label`, `delete_label`, `attach_label`, `detach_label`, `list_entity_labels`), typecheck lolos.
- [x] UI pemilihan label di **form transaksi** (`LabelField`, multi-select combobox + chip + inline create, pola `ContactField`) — diimplementasikan & ditest manual 10 skenario (create, multi-label, reuse existing, hapus chip, prefill edit, detach, tambah saat edit, opsional, sync cloud, case-insensitive), SEMUA lolos 2026-10-10.
- [x] `LabelField` dipindah ke `shared/labels/label-field.tsx` (generik, bukan cuma milik transaksi) — dipakai ulang di 3 form tanpa duplikasi.
- [x] UI pemilihan label di **form kategori** (scope `transaction_category`, sama dictionary dgn transaksi) — `apply-category-labels.ts`/`use-category-labels.ts` dibuat, field selalu tampil (tidak conditional). Typecheck + 219 test existing lolos, BELUM ditest manual via `tauri dev` (lihat catatan di bawah).
- [x] UI pemilihan label di **form akun** (scope `account`, khusus jenis instrumen investasi) — `apply-account-labels.ts`/`use-account-labels.ts` dibuat, field HANYA tampil saat `account_type === 'investment'` (konsisten dgn field `unit_label`/`current_market_value` yg juga conditional di situ). Race condition prefill (pola sama yg diperbaiki di transaksi) langsung ditambal sekalian di sini krn `use-update-account.ts` sudah py pola serupa utk `investmentAccount`. Typecheck + 219 test existing lolos, BELUM ditest manual.
- [x] Query helper fallback kategori→transaksi ditulis & diverifikasi: `shared/labels/effective-label-subquery.ts` (fragment EXISTS, dipakai filter) + `EFFECTIVE_LABELS_SUBQUERY`/`splitEffectiveLabels` di `interface.ts` (fragment GROUP_CONCAT, dipakai tampilan). Resolusi fallback diverifikasi BENAR thdp SQLite nyata lewat 3 skenario (label eksplisit menang, fallback ke kategori saat transaksi kosong, kosong total saat `category_id IS NULL` — bukan error). Delimiter GROUP_CONCAT (U+001F) sempat salah diverifikasi via ekstraksi teks source (template literal TS tidak bisa dibaca sbg teks mentah, harus dieval modul JS sungguhan) — ditangkap test `interface.test.ts`, bukan bug di kode production.
- [x] Tampilan label efektif di daftar transaksi (`info.tsx`, badge `outline` di baris kategori) + filter by label di toolbar (`FILTER_CONFIG` key `label`, type `combobox` multi-select existing — TERNYATA sudah native, tidak perlu komponen baru). Filter hormati 4 operator (`eq`="Adalah" union/OR, `neq`="Bukan", `is_null`="Kosong", `is_not_null`="Tidak kosong") lewat `extract-label-condition.ts`, 9 test unit lolos. Typecheck + 233 test (219 lama + 14 baru) lolos. BELUM ditest manual via `tauri dev`.
- [x] Integrasi label scope `account` (jenis instrumen) ke halaman Ringkasan Investasi (`/investments`, 2026-10-10) — 3 bagian: (1) badge label di `InvestmentAccountCard` (tab Detail) + `InvestmentBreakdownList`; (2) kartu baru "Per Jenis Instrumen" (`investment-label-breakdown.tsx`) — total modal/nilai pasar/P&L dikelompokkan per label lewat `aggregate-by-label.ts`; (3) pie chart "Distribusi Nilai Pasar" dapat toggle mode Per Akun/Per Jenis (reuse `BalancePie` yang sudah generik, tanpa ubah komponennya). Keputusan desain: akun dgn LEBIH DARI SATU label (mis. "RDPU" + "Dana Darurat" bersamaan) dihitung PENUH di SETIAP label yang dimilikinya saat agregasi (overlap SENGAJA, bukan dipartisi) — total lintas baris breakdown per-label BISA melebihi total modal sungguhan kalau ada akun multi-label; akun tanpa label sama sekali masuk grup "Tanpa Label", bukan hilang dari agregasi. 8 test unit (`aggregate-by-label.test.ts`) lolos, termasuk kasus overlap & grup tanpa label. Typecheck + 241 test total lolos. BELUM ditest manual via `tauri dev`.
- [x] Breakdown **per label** di laporan Cashflow (`/laporan`, 2026-10-10) — opsi ketiga di dropdown "Kelompokkan" (setelah Grup Akun & Kategori Induk), berlaku utk kolom Pemasukan maupun Pengeluaran berikut pie chart & drill-down. Helper baru `shared/labels/primary-label-subquery.ts` memakai fallback transaksi->kategori yang sama dgn fragment label lain, tapi `MIN(l.name)` (BUKAN `GROUP_CONCAT`): beda dari halaman Investasi yang sengaja overlap, breakdown cashflow dibaca sbg angka yang HARUS BERJUMLAH PAS dgn total pemasukan/pengeluaran, jadi transaksi multi-label cuma dihitung di SATU label (urut alfabetis) — konsekuensinya label kedua dst tidak terlihat di laporan ini (keputusan 2026-10-10). Drill-down memakai KATEGORI sbg pecahan anaknya (label transaksi umumnya diwarisi dari kategori), diambil dari transaksi yang benar-benar masuk grup itu — bukan filter `parent_id`, krn 1 label bisa memuat kategori lintas induk. Diverifikasi thd SQLite nyata (bukan cuma typecheck): breakdown + drill-down cocok baris-per-baris & berjumlah pas, termasuk kasus multi-label dan fallback kategori. 3 test unit baru, 244 test total lolos.
- [x] **Pull** label dari D1 ke desktop (2026-10-10) — SEBELUMNYA TERLEWAT: 4 tabel label tidak ada di `/sync` Worker MAUPUN di `pull-sync.ts`, jadi label yang dibuat lewat MCP tidak pernah sampai ke desktop (arah push sudah jalan sejak awal, arah pull tidak ada sama sekali). Junction TIDAK memakai `applyRow` generik melainkan `applyLabelJunctionRow` yang beroperasi atas PASANGAN `(entity_id, label_id)` — baris junction diidentifikasi oleh UNIQUE-nya, bukan oleh `id`, jadi `ON CONFLICT(id)` akan pecah 2067 saat pasangan sama datang dgn `id` berbeda. Diverifikasi thd salinan `finance.db` nyata: pull pertama 3/1 -> 7/39 bersih, pasangan sama dgn `id` beda tidak menggandakan baris, pull ulang idempoten, detach lintas device tetap kena, FK/integrity bersih. Lihat `docs/dogfooding/2026-10-10-label-mcp-tidak-sampai-desktop-dan-jebakan-checkpoint.md` — termasuk jebakan checkpoint: deploy + build saja TIDAK cukup, checkpoint yang terlanjur maju harus dimundurkan supaya Worker mau mengirim ulang.

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

**Dikonfirmasi ulang 2026-10-09** — opsi gabung `transaction_labels` +
`category_labels` jadi satu tabel polymorphic sempat dipertimbangkan lagi
(motivasi: scope baru di masa depan tidak perlu tabel/migrasi baru), tapi
TETAP ditolak, keputusan final FK ketat (3 tabel terpisah). Trade-off yang
disadari dan diterima: menambah scope yang menyasar KOMBINASI TABEL BARU
(bukan transaction/category/account yang sudah ada) tetap butuh migrasi
tabel baru — ini harga yang dibayar demi FK integrity otomatis (SQLite
tolak insert `*_id` yang tidak exist, `ON DELETE CASCADE` otomatis
bersihkan baris label saat baris induknya dihapus). Alternatif polymorphic
hanya menghasilkan "data kotor" (baris orphan menumpuk tanpa cascade,
`entity_type`+`entity_id` salah pasang tidak tertangkap SQLite) — bukan
fatal/merusak kalkulasi finansial (label murni query-only), tapi
berlawanan dengan kebiasaan proyek ini yang konsisten pakai FK/CHECK
ketat di semua tabel relasi lain, dan mengulang kelas bug yang sama dgn
`docs/dogfooding/2026-10-09-upload-attachment-corrupt-dan-orphan.md`
(attachment orphan krn cascade tidak jalan) — bedanya di sana ada fix,
di sini risikonya dihindari dari awal dgn tetap pakai FK sungguhan.

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

## Draf skema (final)

Mengikuti pola tabel paling baru di proyek ini (`transaction_attachments`,
lihat `apps/worker/schema/0003_transaction_attachments.sql` dan
`apps/desktop/src-tauri/migrations/0028_cloud_sync_columns.sql`) — karena
label disync dari awal (keputusan 2026-10-09), SEMUA tabel baru di sini
(termasuk junction table) ikut pola penuh: `id` UUIDv7 dari caller (bukan
autoincrement), `updated_at`/`deleted_at`/`sync_source` untuk LWW +
soft-delete, trigger auto-refresh `updated_at`. Ini proyek PERTAMA kali
punya junction table M2M — diputuskan junction table TETAP punya `id`
sendiri (bukan composite PK polos) justru supaya tidak perlu bikin pola
baru di `cloud_sync_queue` (yang row_id-nya selalu 1 kolom TEXT) atau pola
soft-delete baru di luar yang sudah mapan.

```sql
-- Tabel master, dictionary label lintas tabel.
CREATE TABLE labels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('transaction_category', 'account')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (name, scope)
);

-- Junction: transaksi -- label. many-to-many, boleh >1 label/scope/baris
-- (keputusan 2026-10-09 -- bentrok makna antar label jadi urusan user,
-- bukan divalidasi di level skema/aplikasi).
CREATE TABLE transaction_labels (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (transaction_id, label_id)
);

-- Junction: kategori -- label. Scope sama dgn transaction_labels
-- ('transaction_category') krn label jenis ini dipakai bersama sbg
-- fallback (lihat "Resolusi nilai efektif") -- BUKAN scope ketiga terpisah.
CREATE TABLE category_labels (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (category_id, label_id)
);

-- Junction: akun -- label (jenis instrumen investasi, dst).
CREATE TABLE account_labels (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (account_id, label_id)
);

CREATE INDEX idx_labels_scope ON labels(scope);
CREATE INDEX idx_transaction_labels_transaction ON transaction_labels(transaction_id);
CREATE INDEX idx_transaction_labels_label ON transaction_labels(label_id);
CREATE INDEX idx_category_labels_category ON category_labels(category_id);
CREATE INDEX idx_category_labels_label ON category_labels(label_id);
CREATE INDEX idx_account_labels_account ON account_labels(account_id);
CREATE INDEX idx_account_labels_label ON account_labels(label_id);
```

Catatan desain:

- **`scope` final 2 nilai**: `transaction_category` (dipakai bersama oleh
  `transaction_labels` DAN `category_labels` — satu dictionary label yang
  sama, karena keduanya saling fallback, lihat "Resolusi nilai efektif")
  dan `account` (khusus `account_labels`, jenis instrumen investasi dst).
  Pertanyaan lama "perlu scope ketiga?" terjawab TIDAK — scope menjawab
  "dictionary label mana", bukan "tabel junction mana", dan
  transaction/category sengaja berbagi dictionary yang sama.
- **UNIQUE per junction** (`UNIQUE(transaction_id, label_id)` dst) murni
  mencegah duplikat attach label YANG SAMA dua kali ke baris yang sama —
  BUKAN pembatas "1 label per scope" (itu sudah diputuskan boleh banyak).
- **`id` tiap junction row** dipakai sbg `row_id` di `cloud_sync_queue`
  (perlu ditambah ke CHECK constraint `cloud_sync_queue.table_name`,
  pola persis 0043/0044) dan sbg primary key tabel D1 versi Worker.
- Soft-delete (`deleted_at`) di junction berarti "detach" = UPDATE
  `deleted_at`, bukan DELETE fisik — konsisten dgn tabel lain, dan
  perlu supaya device lain yg belum sync tahu label itu sudah dicopot
  (DELETE fisik tidak kebawa ke LWW pull/push).
- Belum final: endpoint Worker (CRUD label + attach/detach) dan daftar
  tool MCP yg dibutuhkan — lihat "Pertanyaan terbuka" sisa di bawah.

## Rencana endpoint Worker & tool MCP (2026-10-09)

Keputusan: CRUD full, pola PERSIS modul `attachments` (bukan
`account-groups` yg cuma create/update/delete tanpa GET) — krn label,
beda dari account-groups, perlu dibaca lintas device scope "label apa
saja yg ada" sebelum bisa attach, dan perlu list "label apa yg nempel
di baris ini" utk MCP (`list_attachments`-style).

Ada 2 "entitas" beda yg masing-masing butuh CRUD sendiri: **tabel
master** (`labels` — kelola dictionary itu sendiri) dan **relasi
attach/detach** (3 junction table — kelola yg nempel ke baris mana).
Keduanya dibutuhkan, bukan salah satu cukup.

### Worker: `apps/worker/src/modules/labels/`

Router baru, pola persis `attachments/router.ts`:

```
labelsRouter.use(requireAuth);
labelsRouter.post("/", handlePostLabel);              // create label baru (tabel master)
labelsRouter.get("/", handleListLabels);               // list label, filter ?scope=
labelsRouter.patch("/:id", handlePatchLabel);          // rename label
labelsRouter.delete("/:id", handleDeleteLabel);        // soft-delete label (cascade ke junction via FK)

labelsRouter.post("/:scope/:entityId", handleAttachLabel);   // attach: scope = transactions|categories|accounts
labelsRouter.delete("/:scope/:entityId/:labelId", handleDetachLabel); // detach (soft-delete junction row)
labelsRouter.get("/:scope/:entityId", handleListEntityLabels); // label apa yg nempel di 1 baris
```

`:scope` di path attach/detach/list menentukan junction table mana yg
disentuh controller (`transaction_labels`/`category_labels`/
`account_labels`) — bukan kolom `labels.scope` yg dipakai utk filter
dictionary saat create/list label master.

### MCP: `apps/mcp-server/src/lib/mcp-tools/labels/`

Tool baru, pola persis `attachments/*.ts` (1 file per operasi):

- `create-label.ts` — `create_label` (name, scope)
- `list-labels.ts` — `list_labels` (filter scope opsional) — dicek dulu
  sebelum attach, sama spt `list_attachments` dicek sebelum
  `upload_attachment` di pola attachment.
- `update-label.ts` — `update_label` (rename)
- `delete-label.ts` — `delete_label`
- `attach-label.ts` — `attach_label` (scope, entity_id, label_id) — 1
  tool generik lintas 3 junction table (BUKAN
  `attach_transaction_label`/`attach_account_label` terpisah) krn
  bentuknya identik, cuma `scope` yg beda — menghindari 6 tool nyaris
  kembar (3 attach + 3 detach) demi 1 parameter.
- `detach-label.ts` — `detach_label` (scope, entity_id, label_id)
- `list-entity-labels.ts` — `list_entity_labels` (scope, entity_id) —
  label apa yg nempel di 1 transaksi/kategori/akun tertentu.

### Belum final, perlu dirinci saat implementasi (bukan desain besar)

- Nama param MCP persis apa (`scope` vs `target`, dst) — placeholder di
  atas, bisa berubah saat nulis Zod schema sungguhan.
- Apakah `handleDeleteLabel` (hapus dari dictionary) perlu validasi
  tambahan kalau label masih dipakai di banyak baris (biarkan CASCADE
  soft-delete semua junction-nya sekalian, atau tolak dulu dgn pesan
  error "masih dipakai di N baris")? — keputusan kecil, tunda ke saat
  implementasi controller, bukan blocker desain skema/endpoint.

## Pertanyaan terbuka (semua sudah diputuskan — riwayat keputusan)

Semua pertanyaan desain yang sempat terbuka sudah dijawab, lihat
checklist status di paling atas dokumen utk daftar lengkap +
"Draf skema" dan "Rencana endpoint Worker & tool MCP" utk detailnya.
Ringkasan riwayat (2026-10-09):

- **Multiplisitas label per scope**: boleh lebih dari satu, tidak
  mutually exclusive, tidak divalidasi aplikasi.
- **Sinkronisasi**: disync ke `apps/worker`/`apps/mcp-server` sejak
  awal (bukan desktop-only dulu seperti pola investasi).
- **Pattern UI**: multi-select combobox biasa.
- **Pembuatan label baru**: inline dari form transaksi/kategori/akun.
- **Skema junction table**: FK ketat, 3 tabel terpisah dgn `id`
  sendiri (bukan polymorphic, bukan composite PK polos) — dipertimbangkan
  ulang sekali, tetap ditolak gabung jadi 1 tabel.
- **Endpoint & tool**: CRUD full pola `attachments` — 1 router
  `labels` di Worker (create/list/update/delete label master +
  attach/detach/list per scope), 7 tool MCP generik lintas scope
  (bukan dipisah per tabel target).

Tidak ada pertanyaan desain besar yang tersisa. Sisa pekerjaan murni
implementasi — lihat checklist status di atas.
