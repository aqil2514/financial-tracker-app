# Handover — 2026-09-30 (sesi 1)

Lanjutan dari `2026-09-29-3-dry-run-live-restrukturisasi-debts-dan-riset-turso-mcp.md`.
Sesi ini FOKUS TUNGGAL: migrasi primary key `INTEGER AUTOINCREMENT` →
UUID v7, dari nol (riset + keputusan desain) sampai implementasi penuh
+ verifikasi live — dipicu pertanyaan lanjutan soal titik sambung MCP
server (poin 4 handover sebelumnya), yang ternyata butuh Turso, yang
ternyata butuh UUID selesai dulu.

## Ringkasan hasil sesi

### Migrasi UUID v7 — SELESAI TOTAL (skema + Rust + TypeScript + verifikasi live)

Dokumen lengkap dengan seluruh detail teknis, keputusan, dan jejak
audit: **`docs/todos/plan/uuid-migration.md`** (dibuat sesi ini, ~540
baris) — WAJIB dibaca sebelum menyentuh apa pun yang berhubungan
dengan ID/primary key. Ringkasan di sini CUMA garis besar.

**Keputusan desain yang diambil (semua final, sudah dieksekusi):**
- **Format UUID v7** (bukan v4) — insert pattern index SQLite tetap
  "naik" seperti AUTOINCREMENT lama (v4 acak murni akan fragmentasi
  index), DAN asumsi "id = urutan waktu" (`ORDER BY id`) tetap valid.
- **Generate UUID di SQL murni** (bukan Rust seperti dugaan awal) —
  migrasi Tauri (`tauri-plugin-sql`) cuma bisa jalankan SQL string via
  `include_str!`, tidak bisa sisipkan logic Rust. Ekspresi UUID v7
  manual (timestamp+randomblob) ditulis & diuji 6000x generate, 0
  tabrakan.
- **TIDAK pakai `legacy_id`** — skala data kecil (~5811 baris total)
  memungkinkan verifikasi PENUH di tiap tahap (scratchpad→dev→live),
  jaring pengaman kolom permanen jadi marginal.
- **Sekarang, bukan nanti** — sebelum `account-type.md` (yang sendiri
  BELUM siap eksekusi, masih 3 poin "belum diputuskan").
- **SEKALIAN** (diminta user): `categories.created_at` ditambahkan
  (satu-satunya dari 9 tabel yang sebelumnya tidak punya kolom itu).

**Eksekusi (urutan, semua SELESAI):**
1. Audit modul import Money Manager (Rust) — ternyata SUDAH generate
   ID manual (`(i+1) as i64`), bukan pasrah auto-increment untuk
   3 dari 4 tabel — jadi tempat uji pola pertama.
2. Crate `uuid` di `Cargo.toml` — tambah feature `v7` (feature `v4`
   sudah ada duluan, dipakai `attachments/mod.rs` utk nama file).
3. Update modul import Money Manager ke UUID v7 (`plan/*.rs`,
   `command/writer.rs`) — `cargo check` bersih.
4. **Migrasi skema**: `src-tauri/migrations/0027_uuid_primary_keys.sql`
   (~18KB, migrasi TERBESAR di proyek ini) — rebuild 9 tabel sekaligus
   ikut pola "rename-semua→create-semua+remap FK via kolom `new_id`
   sementara→drop-semua-di-akhir" dari migrasi 0009/0022 (bukan proses
   tabel satu-per-satu, itu bug yang sudah pernah kejadian). Diuji
   EKSTENSIF di scratchpad sebelum disentuh ke `finance.dev.db` asli:
   jumlah baris identik (5811), `foreign_key_check`/`integrity_check`
   bersih, cross-check agregasi SUM(amount) per akun identik persis
   sebelum/sesudah, 0 tabrakan UUID di seluruh tabel.
5. `src/lib/db.ts` — 7 type definition, semua `id`/`*_id` jadi `string`.
6. **Audit manual seluruh `src/`** — INI YANG PALING BESAR & PALING
   PENTING dari sesi ini. `tsc --noEmit` sempat naik ke 202 error di
   35 file sebelum turun bertahap ke 0. TAPI temuan paling kritis
   BUKAN dari compiler sama sekali:
   - **8 titik `INSERT INTO` di seluruh codebase yang pasrah ke
     SQLite auto-increment, TIDAK menyertakan kolom `id`** — kalau
     tidak diperbaiki, INSERT akan gagal/aneh runtime (kolom `id`
     sekarang `TEXT PRIMARY KEY` tanpa default). Ditemukan LEWAT
     `grep "INSERT INTO" src/` manual, BUKAN dari tsc/cargo check
     (rusqlite/sqlx tidak type-check terhadap skema real). 4 dari 8
     titik ada di modul sync Retailku (`insert-cashflow-transaction.ts`,
     `insert-ar-ap-transaction.ts`, `insert-ar-ap-payment.ts`,
     `insert-ar-ap-payments-batch.ts`) — NYARIS TERLEWAT karena tidak
     ada error compiler yang menunjuk ke situ.
   - Dibuat helper terpusat `src/lib/id.ts` (`newId()`, pakai package
     npm baru `uuidv7` — `crypto.randomUUID()` bawaan CUMA v4, tidak
     bisa dipakai) — dipanggil di SEMUA titik INSERT baru.
   - **Bug nyata ditemukan** (bukan cuma type mismatch):
     `settleDebtIds.map(Number)` di `apply-debt-transaction.ts` —
     akan hasilkan `NaN` utk semua UUID kalau tidak diperbaiki (jalur
     alokasi FIFO pelunasan utang piutang).
   - `a.id - b.id` (aritmetika ID) di `debts-summary/content/utils.ts`
     → diganti `.localeCompare()`.
   - Semua `Number(id)`/`Number(xxx_id)` yang mengonversi form value
     balik ke number sebelum kirim ke query — DIHAPUS di seluruh form
     (transaksi, debt, 3 form mapping Retailku).
7. `tsc --noEmit` (0 error) + `vitest run` (153/153 lulus, termasuk
   `apply-debt-transaction.test.ts` yang DITULIS ULANG TOTAL — fake DB
   disesuaikan pola INSERT baru) + `cargo check` (bersih).
8. **Verifikasi live `tauri dev`**: backup `finance.dev.db` dulu
   (`bak_20260930_041148_pre-uuid-migration`, disimpan di
   `AppData/Roaming/com.windows.financial-app/`) → user restart →
   migrasi 27 jalan otomatis → diverifikasi via query scratchpad
   (jumlah baris identik, 0 FK violation, agregasi identik). Lalu user
   BUAT TRANSAKSI BARU SUNGGUHAN dari UI (expense, note "test") →
   diverifikasi: UUID v7 valid, `account_id`/`category_id` resolve ke
   nama asli (JOIN berhasil, bukan orphan). **User memilih CUKUP
   sampai di situ** — tidak coba akun/kategori/kontak/debt lain,
   "sisanya ketahuan selama dogfooding".

## Status kode saat ini (PENTING, baca sebelum lanjut apa pun)

- **SEMUA primary key sekarang UUID v7 (`TEXT`)**, bukan lagi
  `INTEGER AUTOINCREMENT`. Kalau ada dokumen/memori lama yang
  menyebut ID sebagai number, itu SUDAH USANG.
- **`tauri dev` DIMATIKAN di akhir sesi** (user minta eksplisit) —
  `desktop.exe` di-kill paksa. Restart berikutnya akan compile ulang
  Rust dari awal (~30 detik, `cargo check` sudah bersih jadi seharusnya
  tidak ada masalah).
- **BELUM ADA SATU FILE PUN DI-COMMIT** sepanjang sesi ini (>100 file
  berubah, git status masih `M`/`??` semua) — TERMASUK handover sesi
  SEBELUMNYA (`2026-09-29-3-...md`) yang juga masih untracked. User
  belum diminta/menyetujui commit.
- **Modul import Money Manager BELUM dites end-to-end nyata** sejak
  migrasi 27 — secara skema+kode SUDAH cocok (langkah 3 di atas), tapi
  belum ada satu kali pun percobaan import file Money Manager
  sungguhan sejak perubahan ini. Kalau user mau import ulang data,
  INI yang paling layak dicoba duluan sebagai verifikasi tambahan.
- Package baru: `uuidv7` (npm, zero-dependency) — sudah ada di
  `package.json`/`package-lock.json`, TAPI belum di-commit (lihat
  poin di atas).

## Verifikasi hasil kerja sesi ini

1. `npx tsc --noEmit` — 0 error (turun dari puncak 202 error saat
   `db.ts` pertama diubah, lewat 8 ronde perbaikan bertahap).
2. `npx vitest run` — 153/153 lulus (1 file test ditulis ulang total:
   `apply-debt-transaction.test.ts`; ~9 file test lain disesuaikan
   sebagian: literal ID number→string, assertion `params` array yang
   geser index krn `id` jadi parameter pertama).
3. `cargo check` — bersih, dijalankan 2x (setelah modul import diubah,
   setelah migrasi 27 ditambah).
4. Migrasi 27 diuji EKSTENSIF di scratchpad (bukan cuma dijalankan)
   sebelum disentuh ke `finance.dev.db` asli — lihat detail poin 4 di
   atas.
5. **User mengkonfirmasi VISUAL + query SQL langsung**: restart
   `tauri dev` sungguhan, migrasi 27 jalan otomatis (diverifikasi versi
   27 `success=1` di `_sqlx_migrations`), buat transaksi baru dari UI,
   diverifikasi lewat query scratchpad (UUID valid, FK resolve benar).

## Gap yang TERSISA untuk sesi berikutnya

1. **Belum di-commit** — semua perubahan sesi ini (migrasi UUID
   lengkap) + handover sesi sebelumnya, masih di working tree. User
   belum diminta/setuju untuk commit.
2. **Modul import Money Manager belum dites end-to-end nyata** — lihat
   di atas, prioritas verifikasi tambahan kalau ada kesempatan.
3. **Dogfooding lanjutan** — user sengaja TIDAK menguji semua jalur
   (akun/kategori/kontak/debt baru, edit, hapus, dst) di sesi ini,
   memilih biarkan "ketahuan selama dogfooding" pemakaian normal.
   Kalau ada bug muncul dari sini, kemungkinan besar terkait sisa titik
   INSERT/UPDATE/DELETE yang belum tersentuh audit manual sesi ini.
4. **Turso — BELUM siap eksekusi**, walau UUID (prasyaratnya) sudah
   selesai. Yang MASIH menghalangi (dari `multi-device-sync.md`):
   - Strategi conflict resolution BELUM diputuskan (last-write-wins
     vs deteksi+tanya user vs append-only) — SOAL TERPISAH dari UUID.
   - Tooling belum final dibandingkan resmi (Turso vs PowerSync vs
     custom sync engine).
   - Belum ada kode integrasi sama sekali (`@libsql/client`, logic
     sync push/pull, provisioning database per user).
   - Server perantara (Turso Platform API call) belum dirancang.
   User bertanya "siap ke Turso?" di akhir sesi — dijawab: prasyarat
   teknis (UUID) selesai, TAPI Turso sendiri masih "opsi yang condong
   dipilih", bukan "siap diimplementasikan". Langkah realistis
   berikutnya: jawab dulu strategi conflict resolution SEBELUM mulai
   coding sync engine — itu keputusan desain yang mempengaruhi cara
   sync engine ditulis nanti. User belum menjawab, minta dibahas di
   SESI BERIKUTNYA (makanya handover ini ditulis).
5. **MCP server untuk Claude Web** — status TETAP sama seperti handover
   sebelumnya: riset matang, 0% implementasi, MASIH menunggu Turso
   (dan sync multi-device) selesai duluan sebelum bisa mulai. Lihat
   `docs/todos/plan/mcp-server-for-claude.md`.

## Catatan proses (feedback untuk sesi berikutnya)

- **User TIDAK ingin migrasi database besar dieksekusi langsung tanpa
  konfirmasi eksplisit** — sempat ditanya via AskUserQuestion "mulai
  eksekusi sekarang vs catat dulu" SETELAH semua keputusan desain
  selesai dibahas; user pilih "catat dulu" di percakapan itu, TAPI
  beberapa giliran kemudian secara eksplisit minta eksekusi mulai
  ("boleh, tulis dulu rencana migrasinya" → ... → "boleh, update dulu
  agar uuid v7" → eksekusi mulai jalan). Pola: user nyaman eksekusi
  bertahap per langkah kecil yang diminta eksplisit, BUKAN sekali besar
  otomatis walau sudah ada "rencana lengkap" tertulis.
- **User memutuskan pendekatan teknis lewat pertanyaan terarah saat
  ada 2+ opsi nyata** — dipakai AskUserQuestion 2x di sesi ini: (1)
  generate UUID di SQL vs Rust (setelah ditemukan migrasi Tauri tidak
  bisa jalankan Rust), (2) pakai package `uuidv7` npm vs
  `crypto.randomUUID()` v4 utk sisi TS. Konsisten dgn pola sesi-sesi
  sebelumnya (filter "Jenis" OR/AND, folder restrukturisasi) — jangan
  putuskan sendiri kalau ada trade-off nyata yang user bisa punya
  preferensi.
- **Audit "cari SEMUA titik yang terpengaruh" lewat grep manual
  menyeluruh (bukan cuma andalkan compiler) terbukti KRUSIAL** —
  8 titik INSERT yang nyaris lolos TIDAK AKAN ketahuan dari
  `tsc`/`cargo check` sama sekali (rusqlite/sqlx tidak type-check
  skema real). Pelajaran utk migrasi serupa ke depan: SETELAH compiler
  bersih, WAJIB tetap `grep` manual utk pola-pola yang compiler tidak
  bisa deteksi (INSERT tanpa kolom wajib, konversi tipe implisit yang
  "kebetulan" tetap type-safe tapi salah secara nilai/logika).
- **User berhenti dogfooding manual setelah SATU bukti representatif**
  cukup — tidak perlu menguji SEMUA jalur CRUD satu-satu kalau jalur
  paling kompleks (transaksi, menyentuh 2 FK + trigger debt logic)
  sudah tervalidasi bersih. Konsisten dengan gaya kerja "percaya proses
  verifikasi bertahap yang sudah terbukti", bukan minta 100% coverage
  manual tiap sesi.
