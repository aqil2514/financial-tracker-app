# Sinkronisasi Multi-Device (Desktop + Mobile)

## Latar belakang

Selain rencana integrasi satu arah dengan Retailku (lihat
`retailku-integration.md`), ada rencana lain: `financial-app` versi
MOBILE (Tauri mobile atau platform lain, fungsi sama — transaksi, akun,
kategori, dst), yang datanya perlu bisa dipakai/diedit dari HP maupun PC
dan tetap konsisten satu sama lain (mis. tambah transaksi di HP saat di
luar, muncul juga di desktop nanti).

## Kenapa ini beda kasus dari sync Retailku

Sync Retailku sifatnya SATU ARAH, SATU SUMBER KEBENARAN — Retailku selalu
benar, `financial-app` cuma menyerap data agregasi harian (lihat
`retailku-integration.md`). Multi-device sync di sini sifatnya DUA ARAH,
BANYAK SUMBER TULIS — desktop dan mobile bisa SAMA-SAMA menulis data
kapan saja, termasuk saat keduanya offline dari satu sama lain (mis. edit
transaksi yang sama di HP dan PC di waktu yang berbeda, sebelum sempat
sync). Ini butuh strategi CONFLICT RESOLUTION yang sama sekali tidak
diperlukan di kasus Retailku.

## Prinsip yang tetap harus dipegang: offline-first di KEDUA device

- Tiap device (HP, PC) tetap punya SQLite lokal sendiri, tetap bisa baca
  DAN TULIS penuh tanpa internet — persis seperti aplikasi desktop
  sekarang. Sync bukan syarat supaya device bisa dipakai.
- Sync terjadi HANYA saat online, sifatnya push+pull BERKALA (bukan
  realtime yang mewajibkan koneksi terus-menerus) — kalau HP offline
  seharian lalu online lagi, sync mengejar ketertinggalan.
- Kalau server sync mati atau tidak ada internet, KEDUA device tetap
  100% bisa dipakai sendiri-sendiri secara independen — cuma belum saling
  tahu perubahan satu sama lain sampai online lagi.

## Yang beda dari kasus Retailku: butuh conflict resolution + server perantara

- **Conflict resolution** — kalau HP dan PC sama-sama edit transaksi yang
  sama saat sama-sama offline dari sync, lalu online lagi, harus ada
  aturan siapa yang menang. Strategi umum: "last-write-wins" berdasarkan
  timestamp, atau versioning per baris (mirip `if_version` pada beberapa
  sistem), atau mencegah user mengedit data yang belum sync (kurang ideal
  untuk offline-first). Belum diputuskan strategi mana yang dipakai.
- **Server perantara** — HP dan PC umumnya tidak bisa connect langsung
  satu sama lain (beda jaringan/NAT), jadi butuh titik pertemuan di cloud
  supaya kedua device bisa saling bertukar perubahan. Beda dengan sync
  Retailku yang bisa langsung app→Retailku tanpa infrastruktur tambahan.

## Kemungkinan tooling (belum diputuskan, sekadar referensi arah)

- **Turso/libSQL** — SQLite yang didesain untuk replikasi/sync, embedded
  replicas yang tetap bisa baca-tulis lokal lalu sync ke server pusat.
  Paling dekat dengan arsitektur SQLite yang sudah dipakai aplikasi ini
  sekarang (tidak perlu ganti database engine).

  Biaya dicek langsung ke `turso.tech/pricing` (September 2026): free
  tier — 5GB storage, 500 juta rows read/bulan, 10 juta rows
  written/bulan, 3GB sync/bulan, 100 database. Dibandingkan skala data
  aplikasi ini (`finance.db` saat ini ~741 KB untuk 7704 transaksi hasil
  import Money Manager, lihat `import-category-dedup.md`), kebutuhan
  nyata single-user seperti ini (mungkin puluhan-ratusan baris baru per
  bulan, sync antar 2 device) jauh di bawah 1% dari kuota free tier
  manapun. Kemungkinan besar TIDAK PERNAH perlu bayar untuk kasus
  penggunaan ini.
- **PowerSync** — sync engine yang didesain khusus untuk pola offline-
  first (local SQLite ↔ backend Postgres), sudah menangani conflict
  resolution secara built-in.
- **Sync engine custom** — bangun sendiri lapisan sync sederhana (mis.
  tabel `sync_log`/`change_log` lokal yang dicatat tiap ada perubahan,
  dikirim ke server saat online, server yang broadcast ke device lain) —
  paling banyak effort tapi paling terkontrol.

## Catatan

Masih ide/arah awal, belum ada keputusan desain konkret (strategi
conflict resolution, tooling, kapan versi mobile mulai dibangun). Dicatat
supaya kebutuhan "harus tetap offline-first meski multi-device" ini jadi
constraint yang diingat sejak awal desain data layer — bukan sesuatu yang
ditambal belakangan setelah versi mobile jadi dan ternyata sulit dibuat
offline-first karena arsitektur data awal tidak mempertimbangkan ini.
