# Handover — 2026-10-01 (sesi 2)

Lanjutan dari `2026-10-01-1-port-logic-sisa-crud-lengkap-upsert-lww-sync-pull-fondasi-pc.md`.
Sesi ini FOKUS: tuntaskan Tahap 6 (integrasi klien PC) — UI Settings,
logic pull, push on-write di semua mutation hook, retry queue — lalu
diverifikasi END-TO-END di production nyata (bukan cuma typecheck/unit
test), sampai ketemu dan tutup 3 bug/gap nyata yang baru kelihatan saat
verifikasi.

## Ringkasan hasil sesi

### Tahap 6 — SEMUA todo list checklist SELESAI

- **UI Settings** (`features/settings/content/cloud-sync/`) — section,
  form, hook, pola persis `retailku-integration/`. Toggle eksplisit,
  help text tiap field sengaja jelasin dari mana nilainya berasal
  (`wrangler deploy` output, secret `PC_SYNC_TOKEN`) — DIMINTA user
  diperjelas 2x krn awalnya nyebut jargon developer ("hasil setup
  `wrangler`") tanpa konteks, lalu diminta general-kan dari
  "lewat Claude" jadi "lewat asisten AI yang mendukung MCP" (MCP
  bukan eksklusif Claude).
- **Logic pull** (`pull-sync.ts`+`use-pull-sync.ts`) — jalan sekali
  saat app dibuka via `CloudSyncBootstrap` di `providers.tsx`. LWW
  compare per baris. **Keputusan desain penting**: `deletedAt` dari
  Worker → HARD DELETE lokal (bukan simpan `deleted_at` apa adanya) —
  ditanya ke user krn desktop TIDAK py SATU PUN query yang filter
  `deleted_at IS NULL`, soft-delete mentah akan "hidup tapi
  tersembunyi setengah2" di semua list/laporan.
- **Push on-write** disisipkan ke **17 mutation hooks** (create/
  update/delete × account_groups/accounts/categories/contacts,
  create+update transactions). `pushOnWrite()` dipanggil `void`
  (non-blocking) setelah SQL lokal sukses; delete py keputusan beda
  (push SEBELUM hard-delete, `await` tapi tidak pernah throw).
- **Retry queue** — migrasi `0029_cloud_sync_queue.sql`+
  `0030_cloud_sync_queue_payload.sql`. Isi `{table, id, op}` (baca
  ulang row saat retry), KECUALI `op='delete'` yang wajib simpan
  payload action (reassign/unassign) krn row sudah hard-deleted di
  titik enqueue — actionnya keputusan sesaat user, tidak ada apa pun
  utk "dibaca ulang".

### 3 bug/gap nyata ditemukan SAAT verifikasi production (bukan dari baca kode)

Pola yang SAMA dgn sesi2 sebelumnya: verifikasi end-to-end production
BUKAN formalitas, selalu nemu sesuatu yang tidak kelihatan dari
typecheck/unit test doang.

1. **CORS Worker tidak pernah di-set sama sekali** — ketahuan pas klik
   "Tes Koneksi" pertama kali dari app sungguhan (`Access to fetch ...
   blocked by CORS policy`). Semua verifikasi Worker sebelumnya (sesi
   lalu) lewat `curl`/Node script langsung, bukan browser/WebView,
   jadi celah ini tidak pernah ketahuan sebelumnya. **Fix**:
   `app.use("*", cors())` (Hono, SEMUA origin) di `index.ts` — origin
   WebView Tauri bisa beda2 (dev vs production build), wildcard
   dipilih drpd whitelist krn Worker tetap aman (Bearer token wajib di
   semua endpoint). Di-deploy, diverifikasi via curl preflight.

2. **Gap arsitektur: push-on-write tidak backfill data lama** —
   ketahuan pas user coba tambah transaksi test yang merujuk akun
   LAMA (sudah ada di PC sejak dulu, belum pernah ter-push) → Worker
   balas 500, log `wrangler tail` nunjukin `FOREIGN KEY constraint
   failed`. Akun/kategori/kontak lama memang belum pernah ter-push krn
   push-on-write cuma jalan utk perubahan BARU sejak fitur aktif.
   **Fix**: fitur baru "Sync Semua Data Sekarang" (tombol manual
   terpisah, BUKAN otomatis saat toggle ON — keputusan eksplisit user
   biar sadar kapan proses yang bisa lama ini jalan) —
   `backfill-sync.ts`, push SEMUA data lokal urut FK
   (account_groups→categories→contacts→accounts→transactions).

3. **Bug KEDUA nested di dalam fix #2**: kategori self-referencing
   (`parent_id`) — `SELECT id FROM categories` TIDAK menjamin induk
   terkirim sebelum anak. 36 dari 116 kategori gagal FK + efek domino
   ke ratusan transaksi yang pakainya (773 "gagal" di percobaan
   pertama). **Fix**: `getCategoryIdsParentsFirst()` — 2-pass
   (`parent_id IS NULL` dulu, baru yang py parent), diverifikasi cukup
   krn hierarki data nyata cuma 2 level (tidak ada grandparent).
   **Hasil akhir backfill, setelah fix**: 5764 terkirim, 25 ditolak,
   0 gagal.

### 25 transaksi ditolak Worker — BUKAN bug, divergence historis diterima

Transaksi 2024-2025 (akun "Keluarga", `account_type='debt'`) bertipe
`income`/`expense` biasa — ditolak Worker krn aturan
`violatesDebtAccountRule` ("income/expense tidak boleh sentuh akun
debt, pakai transfer"). Aturan ini BARU ada di Worker (sesi
sebelumnya), desktop lama TIDAK PERNAH menolak transaksi spt ini jadi
data itu valid secara historis di PC. **User EKSPLISIT pilih**:
terima sbg divergence (data tetap normal di PC, cuma tidak ikut
tersinkron ke D1/HP), BUKAN dianggap bug yang perlu di-fix sekarang.

### Bug lama ditemukan & diperbaiki SAMBIL LEWAT (bukan tujuan sesi)

3 dialog delete (`delete-account-group-dialog.tsx`,
`use-delete-account-form.ts`, `delete-category-dialog.tsx`) masih
panggil `Number(targetXxxId)` pada id yang SEBENARNYA UUID STRING
sejak migrasi `0027_uuid_primary_keys.sql` (beberapa sesi lalu) —
selalu mengirim `NaN` ke SQL reassign. Artinya **reassign account/
account-group/category sudah lama rusak senyap** (sejak migrasi UUID),
tidak pernah ketahuan krn tidak ada test/verifikasi khusus utk alur
reassign ini. Ketahuan sbg EFEK SAMPING nyiapin tipe payload push
delete (`targetXxxId` di Worker schema memang `string`, jadi tipe
lokal yang salah `number` ketangkep typecheck begitu disamakan).
Diperbaiki: tipe `DeleteXxxInput` + 3 caller-nya.

### Verifikasi end-to-end — DUA ARAH terbukti jalan di production

- **Push PC→D1**: transaksi "Test Sinkron" ditambah dari UI PC, muncul
  di D1 dalam hitungan detik (dicek via `wrangler d1 execute --remote`).
- **Pull D1→PC**: transaksi "Test dari HP (simulasi)" di-INSERT manual
  ke D1 via `wrangler d1 execute` (mensimulasikan tool MCP, krn
  `apps/mcp-server` belum ada), muncul otomatis di UI PC setelah
  restart app, lengkap dgn join nama akun yang benar.

## Status kode saat ini

- **`apps/worker` LIVE di production**, redeploy 2x sesi ini (CORS
  fix). Version ID terakhir setelah CORS: `1af592f1-d558-4462-93ee-d666f8171898`.
- **D1 production SEKARANG BERISI DATA NYATA** (bukan kosong spt sesi
  sebelumnya) — hasil backfill: ~5764 baris transaksi + semua
  account_groups/categories/contacts/accounts milik user. Prosedur
  "seed→verifikasi→hapus, 0 baris tersisa" dari sesi2 sebelumnya TIDAK
  berlaku lagi mulai sesi ini — data di D1 sekarang PRODUKSI
  SUNGGUHAN, bukan data uji yang harus dibersihkan.
- **`apps/desktop` migrasi baru 0029+0030 SUDAH di-apply** ke
  `finance.dev.db` (tabel `cloud_sync_queue` + kolom `payload`).
- Semua perubahan kode (worker + desktop) **BELUM di-commit** — pola
  sama sesi2 sebelumnya, user commit sendiri.
- `apps/mcp-server` MASIH BELUM ADA sama sekali.

## Gap yang TERSISA untuk sesi berikutnya

Detail lengkap di `apps/desktop/docs/todos/plan/mcp-server-cloud-mirror.md`
(bagian "Gap yang TERSISA", baru ditambah sesi ini):

1. `DELETE /transactions/:id` di Worker (sisa kecil Tahap 4) — perlu
   keputusan desain guard dulu, desktop sendiri TIDAK py guard delete
   transaksi.
2. Token MCP terpisah dari `PC_SYNC_TOKEN`.
3. **Tahap 5**: `apps/mcp-server` — BELUM disentuh sama sekali.
4. Uji skenario konflik nyata + soft-delete cross-device — butuh
   Tahap 5 jalan dulu utk skenario realistis.
5. 25 transaksi historis yang ditolak Worker — dibiarkan terbuka
   sengaja, bukan prioritas.

## Catatan proses (feedback utk sesi berikutnya)

- **User menolak tool Agent/subagent sekali di awal sesi** ("lanjut"
  setelah reject) — diinterpretasi sbg "jangan spawn subagent, baca
  kode sendiri di main context", DIKONFIRMASI via AskUserQuestion
  (pilih "baca langsung sendiri"). Pola BARU utk dicatat: user lebih
  suka eksplorasi kode besar dilakukan LANGSUNG (Read manual banyak
  file) drpd didelegasikan ke subagent Explore, setidaknya utk task
  arsitektural besar spt ini dimana keputusan desain penting muncul
  DARI PROSES membaca kode (bukan cuma dari hasil akhir laporan).
- **Verifikasi production (bukan cuma typecheck+unit test) KONSISTEN
  nemu hal yang tidak kelihatan dari baca kode** — pola yang SAMA
  persis dgn sesi sebelumnya, makin menguatkan: utk fitur cloud-sync
  ini, JANGAN PERNAH anggap "typecheck bersih + unit test lolos" sbg
  tanda selesai. 3 temuan sesi ini (CORS, gap backfill, bug kategori
  nested) SEMUA baru ketahuan pas user benar2 klik tombol di app asli
  dan saya trace lewat `wrangler tail`/`wrangler d1 execute` langsung
  ke production.
- **User ingin terlibat aktif di verifikasi, bukan cuma nerima laporan
  akhir** — pola sesi ini: saya kasih instruksi/command, USER yang
  menjalankan (termasuk command CLI `wrangler d1 execute` INSERT
  manual utk simulasi "dari HP"), lalu screenshot hasil balik ke saya
  utk didiagnosis. Beda dgn sesi2 sebelumnya di mana saya yang jalanin
  smoke test sendiri via Node script. Kemungkinan krn sesi ini banyak
  berinteraksi lewat GUI app asli (bukan cuma API/curl), yang memang
  perlu user yg pegang mouse/keyboard.
- **Setiap keputusan desain dgn trade-off TETAP ditanya via
  AskUserQuestion** — pola konsisten dilanjutkan dari sesi2
  sebelumnya (urutan kerja UI-dulu-vs-logic-dulu, urutan push-delete
  vs hard-delete, isi retry queue {id} vs payload-penuh, CORS wildcard
  vs whitelist, trigger backfill otomatis vs manual, cara menangani
  25 transaksi legacy ditolak). User KONSISTEN pilih opsi
  "Recommended" di SEMUA pertanyaan sesi ini (bukan cuma dominan spt
  sesi lalu, kali ini 100%) — pola makin menguat: usulan "Recommended"
  align dgn preferensi user (konservatif, konsisten pola existing,
  user-in-control utk aksi yang bisa lama/besar dampaknya spt
  backfill). TETAP jangan skip tanya meski pola ini kuat — user bisa
  saja beda pendapat di keputusan yang lebih besar dampaknya.
- **Dokumentasi UI (`cloud-sync-form.tsx`) diminta diperjelas 2x
  secara iteratif** setelah pertanyaan user "paham tidak user awam":
  (1) jargon developer → jelaskan dari mana nilai berasal; (2) spesifik
  "Claude" → general-kan ke "asisten AI yang mendukung MCP". Pola:
  user peduli readability teks UI-facing, bukan cuma kode internal,
  dan suka proses iteratif kecil (tanya dulu, baru minta ubah) drpd
  minta sekaligus sempurna di awal.