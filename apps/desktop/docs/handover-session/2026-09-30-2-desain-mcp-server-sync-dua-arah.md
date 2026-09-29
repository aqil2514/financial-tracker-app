# Handover — 2026-09-30 (sesi 2)

Lanjutan dari `2026-09-30-1-migrasi-uuid-v7-lengkap.md`. Sesi ini
FOKUS TUNGGAL: **desain (bukan implementasi)** untuk fitur "kelola data
keuangan dari HP lewat Claude Web, sebelum aplikasi mobile native ada"
— dimulai dari diskusi conflict resolution utk multi-device sync,
berbelok jadi rencana MCP server dgn CRUD dua-arah setelah user
menjelaskan urutan prioritas sebenarnya. TIDAK ADA KODE yang ditulis
sesi ini — murni dokumen rencana + 2 riset mendalam (Agent, web search)
+ 1 riset kode existing (repo lain + codebase sendiri).

## Ringkasan alur sesi (penting utk paham KENAPA dokumen berubah 2x)

1. Mulai dari pertanyaan user "conflict resolution strategy gimana?"
   utk `multi-device-sync.md` (dokumen lama, ide sync desktop↔mobile).
   → Diputuskan **last-write-wins via `updated_at`**.
2. User minta ditulis jadi todo list di `turso-integration.md` (file
   kosong yg sudah dibuat sebelumnya, judulnya masih asumsi tooling
   Turso). Ditulis lengkap + 3 keputusan tambahan (soft delete utk
   DELETE, `device_id` disertakan dari awal, pemicu sync "saat app
   dibuka+online") + **riset Tahap 0** (Agent) bandingkan Turso vs
   PowerSync vs custom sync — **Turso DITOLAK** (wajib ganti driver DB
   dari sqlx ke crate `libsql`, LWW tidak built-in, roadmap masih
   pre-1.0), keputusan final **custom sync engine + Cloudflare
   Workers/D1**. File di-rename ke `multi-device-sync-engine.md`.
3. **User menyela**: aplikasi desktop belum final, `apps/mobile` masih
   skeleton Expo KOSONG (dicek langsung, cuma `App.tsx` default +
   config) — sync desktop↔mobile jadi PREMATUR. Yang lebih mendesak:
   MCP server dulu (utk Claude Web), TAPI user TIDAK mau PC harus
   menyala terus (jadi Opsi 1 "PC+tunnel" dari `mcp-server-for-claude.md`
   ikut ditolak).
4. → Insight: MCP server (fase awal, DIKIRA read-only) cuma butuh push
   SATU ARAH PC→cloud, jauh lebih simpel dari sync dua-arah. Dibuat
   dokumen BARU `mcp-server-cloud-mirror.md` (bukan modifikasi dokumen
   sync yg sudah ada) + riset lanjutan (Agent) utk 4 hal: akses D1 dari
   Vercel, cara push dari PC, skema autentikasi, daftar tool MCP fase 1.
5. **User menyela LAGI** (poin paling penting sesi ini): ternyata mau
   **CRUD PENUH dari HP, setara operasi PC** — bukan cuma tanya
   saldo/baca data. Ini merombak TOTAL premis "push satu arah" jadi
   **sync dua-arah PC↔D1** (D1 py 2 sumber tulis: PC dan MCP tool atas
   nama HP) — SEMUA implikasi conflict resolution yang tadi "tidak
   perlu" (poin 4) jadi PERLU LAGI, tapi dgn bentuk lebih sempit dari
   `multi-device-sync-engine.md` (bukan 2 device fisik, tapi PC vs tool
   MCP yg selalu online saat dipanggil).
6. Dibahas ulang conflict resolution utk kasus baru ini — user usul
   alternatif "tabel log terpusat", dijelaskan trade-off 3 arah
   (effort/storage vs jaminan tidak kehilangan data) → **user pilih
   TETAP last-write-wins sederhana** (bukan log), demi konsistensi
   "jangan over-engineer" yg dipakai sepanjang sesi.
7. Dokumen `mcp-server-cloud-mirror.md` DITULIS ULANG TOTAL (bukan
   di-patch) merefleksikan sync dua-arah: PC wajib pull-sebelum-push,
   soft delete relevan lagi, `source` per baris (`"pc"`/`"mcp"`, versi
   ringan dari `device_id`), DAN gap besar baru: **logic bisnis app
   desktop (mis. alokasi FIFO pelunasan utang piutang) WAJIB
   direplikasi ke server**, krn tool MCP nulis LANGSUNG ke D1 tanpa
   lewat kode TypeScript app desktop sama sekali.
8. User tanya pemicu PUSH (pull sudah diputuskan "app dibuka+online",
   push belum) → **on-write** dipilih (langsung tiap ada perubahan di
   PC, async, antre kalau offline) — beda dari pull, alasannya window
   konflik makin kecil krn D1 skrg bisa berubah dari HP kapan saja.
9. User tanya titik integrasi UI ("tombol di halaman Settings?") →
   diriset pola EXISTING di `features/settings/` (khususnya
   `retailku-integration/`, kasus paling mirip: sync opsional ke
   layanan luar) via Agent Explore + baca manual — ditemukan pola
   lengkap (folder structure, `<Switch>` component, tabel `settings`
   key-value, keputusan "plaintext bukan keychain" yg SUDAH ada
   presedennya utk `retailku_api_key`). Ditanya ulang scr eksplisit
   apakah token sync cloud ikut plaintext (krn scope-nya lebih besar:
   akses tulis ke SELURUH data keuangan, bukan cuma baca data toko
   sendiri) — **user pilih TETAP plaintext**, konsisten dgn preseden.

## Dokumen yang DIUBAH/DIBUAT sesi ini (semua di
`apps/desktop/docs/todos/plan/`, kecuali disebut lain)

### `multi-device-sync-engine.md` — DIBUAT (rename dari `turso-integration.md`)

Isi: rencana LENGKAP sync desktop↔mobile app NATIF (skenario 2 device
fisik saling offline-first). SEMUA keputusan desain final tercatat:
LWW via `updated_at`, soft delete, `device_id` per device fisik, pemicu
"app dibuka+online", tooling final custom+Cloudflare (BUKAN Turso, alasan
riset lengkap ada di dokumen).

**STATUS: DISIMPAN UNTUK NANTI, BUKAN PRIORITAS SEKARANG** — ditandai
eksplisit di bagian atas dokumen. Baru relevan lagi kalau `apps/mobile`
mulai BENERAN dibangun. Isinya TETAP BENAR sbg rencana, jangan dihapus.

### `mcp-server-cloud-mirror.md` — DIBUAT, DITULIS ULANG TOTAL SEKALI

Ini dokumen AKTIF utama hasil sesi ini. Judul: "MCP Server — Sync
Dua-Arah PC ↔ Cloud + CRUD via Claude" (judul asli "Cloud Mirror
Satu-Arah" SUDAH TIDAK BERLAKU, ditulis eksplisit di catatan paling
atas dokumen kenapa berubah).

**Semua keputusan desain FINAL yg tercatat di sana** (ringkasan, baca
dokumen lengkap utk detail/alasan):
- Conflict resolution: **last-write-wins sederhana via `updated_at`**
  (BUKAN tabel log terpusat — dipertimbangkan & ditolak scr eksplisit).
- Soft delete (`deleted_at`) — relevan lagi krn D1 py 2 sumber tulis.
- `source` per baris (`"pc"`/`"mcp"`, ENUM ringan, BUKAN UUID device
  penuh spt `multi-device-sync-engine.md`).
- PC WAJIB **pull SEBELUM push** (bukan snapshot buta) — per baris,
  bandingkan `updated_at`, yang lebih baru menang.
- Pemicu **pull**: saat app dibuka + online.
- Pemicu **push**: **ON-WRITE** — langsung tiap ada perubahan lokal
  (async, tidak blocking UI), antre kalau offline, dikirim ulang saat
  online lagi. (Beda dari pull — diputuskan terpisah sesi ini.)
- Hosting MCP server: Vercel Hobby + `mcp-handler` (Next.js App
  Router) — TIDAK berubah dari riset paling awal.
- Database cloud: Cloudflare D1 (bukan Turso, alasan sama seperti
  `multi-device-sync-engine.md`).
- Akses D1 BACA (dari Vercel/MCP server): LANGSUNG via REST API resmi
  Cloudflare, TANPA Worker perantara (rate limit 1200/5menit per akun,
  jauh cukup utk skala personal).
- Akses D1 TULIS (dari PC, dan berpotensi dari tool MCP tulis): via
  Cloudflare Worker custom, native binding (bukan REST API) — supaya
  logic validasi bisa terpusat di satu tempat. **BELUM FINAL** apakah
  tool tulis MCP manggil Worker yg sama dgn PC, atau akses D1 langsung
  dari Vercel (condong opsi Worker terpusat, tapi masih open question).
- Autentikasi MCP server: **"OAuth shim" di atas API key statis** —
  BUKAN OAuth beneran dgn user management. Pola ini DITEMUKAN dari
  implementasi LIVE MCP Retailku (`Warung Aqil`, sudah terkoneksi &
  dipakai sesi ini sendiri) di
  `D:\Programming\Pribadi\retail-multitenant\apps\api\src\app\mcp\`
  (file: `mcp-oauth.controller.ts`, `mcp-auth.guard.ts`,
  `mcp.controller.ts`) — Claude Web mewajibkan alur discovery OAuth
  penuh (PKCE S256 dst), tapi di baliknya cukup form HTML 1 field "API
  key", `access_token` yg dikembalikan = API key itu sendiri. Utk
  `financial-app` LEBIH SEDERHANA drpd Retailku krn single-user: satu
  token env var, TANPA tabel database sama sekali.
- **Titik integrasi UI (desktop)** — dibahas detail di akhir sesi:
  section baru `content/cloud-sync/` di `features/settings/`, mengikuti
  struktur `attachment-folder/` (section+form+hook terpisah). Toggle
  EKSPLISIT pakai `<Switch>` yg sudah ada di `components/ui/switch.tsx`
  (BUKAN toggle implisit spt Retailku). Config baru di tabel `settings`
  yg SUDAH ADA (`cloud_sync_enabled`, `cloud_sync_worker_url`,
  `cloud_sync_token`, `cloud_sync_last_checkpoint`) — TIDAK perlu
  migrasi/tabel baru. **Token disimpan PLAINTEXT** (keputusan sadar,
  dipertimbangkan ulang scr eksplisit krn scope lebih besar dari
  kredensial Retailku, tapi user tetap pilih konsisten dgn preseden yg
  ada, BUKAN OS keychain/Stronghold — itu akan jadi preseden BARU yg
  belum ada sama sekali di codebase).
- **5 tool MCP baca fase pertama** (urutan prioritas):
  `get_account_balances`, `get_spending_summary_by_category`,
  `list_recent_transactions`, `get_debt_summary`,
  `get_contact_transaction_history`. Daftar tool TULIS belum
  diputuskan (lihat gap di bawah).

### `mcp-server-for-claude.md` — DIUBAH (ditambah catatan penunjuk)

Dokumen riset PALING AWAL (sesi 2026-09-29) — ISI ASLINYA (Opsi 1 vs
Opsi 2, riset Turso+Vercel+mcp-handler mendalam) TETAP DIPERTAHANKAN
sbg sejarah keputusan, tapi ditambah catatan di bagian akhir: arah
Turso DITOLAK, dan "sync dulu baru MCP" (urutan asli Opsi 2) TIDAK
PERLU lagi krn insight baru (lihat poin di atas) — menunjuk ke
`mcp-server-cloud-mirror.md` sbg dokumen AKTIF sekarang.

## Status kode saat ini

- **TIDAK ADA PERUBAHAN KODE SAMA SEKALI** sesi ini — murni dokumen
  perencanaan (`docs/todos/plan/*.md`) + riset. `git status` cuma
  menunjukkan perubahan file `.md` (lihat daftar di atas) PLUS
  beberapa file lain yg TAMPAKNYA dari sesi/proses LAIN yang berjalan
  paralel/independen (`D apps/desktop/docs/todos/plan/uuid-migration.md`,
  `retailku-dynamic-sourcetype-mapping.md`,
  `retailku-sale-category-mapping.md` — dipindah ke `done/` — TIDAK
  disentuh sesi INI, kemungkinan hasil sesi lain yang jalan bersamaan;
  JANGAN diasumsikan sebagai bagian dari sesi ini, verifikasi dulu
  kalau perlu tahu detailnya).
- **BELUM ADA COMMIT** apa pun sesi ini — semua perubahan (dokumen
  baru+diubah) masih di working tree.
- `apps/mobile` dikonfirmasi masih skeleton Expo kosong (`App.tsx`
  default, `AGENTS.md`/`CLAUDE.md` cuma peringatan "Expo HAS CHANGED,
  baca docs versi eksak") — TIDAK ADA fitur dibangun di sana.

## Gap yang TERSISA untuk sesi berikutnya

Ini SEMUA masih level DESAIN, belum eksekusi. Urutan realistis kalau
mau lanjut ke implementasi:

1. **Tahap 2 di `mcp-server-cloud-mirror.md` (PALING KRITIS, belum
   disentuh sama sekali)**: inventarisir logic bisnis di
   `src/features/*` app desktop yang WAJIB direplikasi ke server —
   krn tool MCP nulis LANGSUNG ke D1 tanpa lewat kode TypeScript app
   desktop. Contoh konkret yg sudah diidentifikasi sesi migrasi UUID
   kemarin: alokasi FIFO pelunasan utang piutang di
   `apply-debt-transaction.ts`. Belum ada daftar lengkap — perlu audit
   menyeluruh, BUKAN cuma satu contoh ini.
2. **Arsitektur tool tulis MCP belum final**: apakah manggil Cloudflare
   Worker yg sama dgn PC (logic terpusat, direkomendasikan tapi belum
   diputuskan resmi), atau akses D1 langsung dari Vercel function
   (duplikasi logic, risiko drift).
3. **Daftar tool TULIS MCP** belum ada sama sekali (baru 5 tool BACA
   yg final) — perlu diputuskan operasi apa saja yg didukung dari HP
   (tambah transaksi? edit? hapus? tambah akun/kategori baru? dst) dan
   urutan prioritas.
4. **Skema kolom sync belum final**: apakah `updated_at`/`deleted_at`/
   `source` di sini REUSE persis sama dgn yg direncanakan di
   `multi-device-sync-engine.md` (kalau mobile native jadi nanti), atau
   dibuat terpisah krn kasusnya beda — berpotensi hemat kerja kalau
   bisa disatukan, belum dipikirkan.
5. Detail teknis kecil yg masih "belum diputuskan" (lihat bagian itu di
   dokumen): nama/struktur endpoint Worker, DI MANA persis token
   di-generate pertama kali (siapa yg jalankan `wrangler` setup).
6. **`multi-device-sync-engine.md` TETAP menunggu** `apps/mobile` mulai
   dibangun — TIDAK ada tindakan yg perlu diambil di situ sekarang,
   cuma diingatkan supaya tidak lupa dokumen itu ada & masih valid.

## Catatan proses (feedback utk sesi berikutnya)

- **User mengoreksi arah 2x dlm satu sesi, KEDUANYA lewat penjelasan
  konteks yg belum sempat disampaikan** (bukan krn analisis asisten
  salah) — pertama soal urutan prioritas (mobile blm ada → sync device
  prematur, MCP dulu), kedua soal SCOPE fitur (dikira read-only,
  ternyata mau CRUD penuh). Pelajaran: utk dokumen desain jangka
  panjang spt ini, LEBIH BAIK tanya eksplisit "apakah butuh tulis atau
  cuma baca?" di awal SEBELUM menulis draft lengkap, drpd berasumsi dari
  frasa "MCP server" scr generik (yg polanya di sesi Retailku KEBETULAN
  cuma dipakai read/sync, bukan tulis).
- **Pola "riset dulu, keputusan berdasar temuan konkret, BUKAN asumsi
  training data"** dipakai konsisten & terbukti berharga 2x: riset
  Turso vs PowerSync vs custom (via web search) MENGUBAH keputusan dari
  "condong Turso" jadi "custom+Cloudflare" krn temuan konkret (Turso
  wajib ganti driver, roadmap pre-1.0). Riset autentikasi MCP MENGUBAH
  asumsi jg: awalnya dikira `static_headers` API key sederhana cukup,
  ternyata itu fitur BETA terbatas — solusi sebenarnya (OAuth shim)
  baru ketemu setelah user mengarahkan utk CEK IMPLEMENTASI LIVE
  Retailku (`retail-multitenant/apps/api`), BUKAN dari riset dokumentasi
  saja. Pola ini (cek implementasi nyata yg sudah terbukti bekerja,
  bukan cuma baca spek) layak diulang kalau ada keputusan serupa lagi.
- **User menolak alternatif "lebih aman/lengkap" 2x demi konsistensi
  kesederhanaan** — tabel log terpusat (event sourcing) utk conflict
  resolution DITOLAK meski ditawarkan dgn alasan kuat ("data keuangan,
  risiko kehilangan data lebih sensitif"), dan OS keychain/Stronghold
  utk token DITOLAK meski token barunya py scope lebih besar dari
  preseden Retailku. Pola user: KONSISTEN pilih opsi yg selaras dgn
  yg SUDAH ADA di codebase/keputusan sebelumnya drpd "upgrade" ke opsi
  lebih aman/robust, SELAMA trade-off-nya sudah dijelaskan eksplisit
  dan risikonya masuk akal utk skala aplikasi personal ini. Jangan
  usulkan opsi "lebih aman tapi lebih rumit" sbg default rekomendasi
  utk kasus serupa ke depan — cukup jelaskan trade-off, biarkan user
  pilih, kemungkinan besar akan pilih yg lebih sederhana.
- **Dokumen ditulis ULANG TOTAL (bukan di-patch sebagian) ketika premis
  dasarnya berubah** (`mcp-server-cloud-mirror.md` ditulis ulang penuh
  sesudah keputusan CRUD) — ini pilihan yg tepat drpd tambal sulam,
  krn hampir semua bagian dokumen (alur, keputusan desain, todo list)
  butuh disesuaikan sekaligus, bukan cuma satu-dua kalimat. Kalau nanti
  ada perubahan premis besar serupa, tulis ulang total lebih baik drpd
  edit bertahap yg berisiko meninggalkan bagian lama yg kontradiktif.
