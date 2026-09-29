# Integrasi Sync — Multi-Device (Custom Engine + Cloudflare)

> Catatan nama file: dokumen ini awalnya diberi nama
> `turso-integration.md` saat Turso masih jadi kandidat utama. Setelah
> riset Tahap 0 (2026-09-30), keputusan final JATUH ke custom sync
> engine + Cloudflare Workers/D1, BUKAN Turso — file sudah di-rename
> jadi `multi-device-sync-engine.md` (2026-09-30). JANGAN tertukar
> dengan `multi-device-sync.md` (dokumen LAIN, ide awal/latar belakang
> sebelum ada keputusan desain apapun) — dokumen ini adalah
> kelanjutannya: keputusan final + todo list eksekusi konkret.
>
> **STATUS (update 2026-09-30, sesi sama): DISIMPAN UNTUK NANTI, BUKAN
> PRIORITAS SEKARANG.** Setelah dokumen ini selesai ditulis, muncul
> pertimbangan: aplikasi desktop sendiri belum final, DAN `apps/mobile`
> masih skeleton Expo kosong (belum ada fitur apa pun dibangun) — sync
> dua-arah antar device baru relevan begitu ada 2+ device yang
> SAMA-SAMA menulis data secara independen, yang belum terjadi sekarang
> karena mobile belum ada. Kebutuhan yang LEBIH MENDESAK (MCP server
> utk Claude Web, tanpa PC harus nyala terus) ternyata tidak butuh sync
> dua-arah sama sekali — cukup push satu-arah PC→cloud, jauh lebih
> sederhana. Lihat `mcp-server-cloud-mirror.md` utk itu. Dokumen INI
> (sync dua-arah penuh dgn conflict resolution, `device_id`, dst) TETAP
> BENAR & lengkap sbg rencana — dipakai LAGI begitu `apps/mobile`
> sungguhan mulai dibangun dan butuh sync beneran.

## Latar belakang

Lanjutan dari `multi-device-sync.md` (ide awal) dan `uuid-migration.md`
(prasyarat teknis, SELESAI 2026-09-30). Primary key sudah UUID v7 di
semua tabel, jadi blocker utama sync sudah tidak ada. Dokumen ini
menurunkan ide awal jadi todo list konkret, dimulai dari keputusan
desain yang sudah diambil.

Konteks penting: ini kasus **single-user, multi-device** (bukan
multi-user/multi-tenant) — jadi "conflict" murni soal "device mana
punya data lebih baru untuk baris yang sama", bukan soal hak/otorisasi
antar orang.

## Keputusan desain yang sudah diambil

- **Strategi conflict resolution: last-write-wins** berdasarkan
  `updated_at` per baris (dipilih 2026-09-30). Alasan: personal finance
  app, kecil kemungkinan baris yang SAMA diedit dari 2 device dalam
  window offline yang sama — trade-off "bisa kehilangan perubahan yang
  kalah, diam-diam" dianggap cukup jarang terjadi untuk kasus ini,
  tidak perlu langsung ke solusi yang lebih berat (deteksi+tanya user,
  atau append-only/event sourcing).
- **Tooling: custom sync engine, server relay di Cloudflare Workers +
  D1** (FINAL, diputuskan 2026-09-30 setelah riset perbandingan
  konkret — lihat "Riset Tahap 0" di bawah untuk detail lengkap dan
  alasan menolak Turso/PowerSync). Ringkas:
  - Turso ditolak: mode sync barunya (bukan embedded replica lama)
    mengharuskan ganti driver database dari `tauri-plugin-sql`/`sqlx`
    ke crate `libsql` langsung — invasif ke kode yang sudah ada — dan
    LWW berbasis `updated_at` tidak built-in (perlu dibangun manual di
    atas conflict API mereka yang defaultnya first-push-wins). Engine
    penggantinya (Turso Database) juga masih pre-1.0 per Sept 2026,
    arah roadmap masih berubah.
  - PowerSync ditolak: arsitekturnya mewajibkan Postgres sebagai
    source-of-truth di backend — tidak cocok sama sekali dengan SQLite
    murni yang sudah dipakai, effort-nya jadi "bangun ulang arsitektur
    data" bukan "tambah sync". LWW bawaannya juga per-field, bukan
    per-row berbasis `updated_at`.
  - Custom sync menang: skema SQLite existing (migrasi manual via
    `include_str!`) TIDAK berubah sama sekali, cuma tambah satu tabel
    `change_log`/`sync_log` + service relay kecil. LWW berbasis
    `updated_at` paling alami diimplementasikan karena logic 100%
    dikontrol sendiri. Cloudflare Workers + D1 dipilih sbg server
    relay: gratis untuk skala ini (jauh di bawah free tier), D1 sendiri
    SQLite juga (skema relay bisa mirroring skema klien, tidak perlu
    belajar Postgres), tidak ada auto-pause seperti Supabase.
- **Strategi DELETE: soft delete** (kolom `deleted_at`, dipilih
  2026-09-30). Alasan: hard delete bikin baris tidak punya jejak untuk
  dibandingkan saat sync — kalau device lain masih offline dan belum
  tahu baris itu terhapus, lalu meng-UPDATE baris itu sebelum sempat
  sync, hasilnya ambigu ("hidupkan lagi" vs "abaikan", tidak ada cara
  membedakan "sengaja dihapus" dari "belum pernah dibuat"). Soft delete
  tetap bisa dibandingkan by timestamp lewat mekanisme last-write-wins
  yang sama. Trade-off yang diterima: semua `SELECT` perlu diaudit utk
  tambah `WHERE deleted_at IS NULL`, dan tabel perlahan menumpuk baris
  "mati" (housekeeping/purge belum dipikirkan, bukan prioritas sekarang).
- **Kolom `device_id`: disertakan dari awal** (dipilih 2026-09-30),
  bukan ditambahkan belakangan. Tidak esensial untuk logic
  last-write-wins itu sendiri (itu 100% berdasarkan `updated_at`), tapi
  berguna untuk audit trail/debugging kalau ada anomali sync nanti
  ("kok baris ini kepilih dari HP bukan PC?"). Perlu identitas device
  stabil yang di-generate & disimpan sekali per install (mis. UUID di
  tabel `settings` atau OS keychain), disertakan di kolom `device_id`
  tiap baris pada INSERT/UPDATE.
- **Pemicu sync: saat app dibuka DAN online** (dipilih 2026-09-30) —
  bukan interval timer yang jalan terus selama app terbuka, bukan juga
  murni manual (tombol "sync sekarang"). Begitu app start dan terdeteksi
  ada koneksi internet, jalankan pull (tarik perubahan device lain)
  lalu push (kirim perubahan lokal yang belum terkirim, termasuk dari
  sesi sebelumnya kalau sempat offline). Tidak ada sync di tengah sesi
  pemakaian maupun saat app ditutup.

## Riset Tahap 0 (ringkasan, 2026-09-30)

Perbandingan konkret 3 opsi tooling (Turso/libSQL Sync, PowerSync,
custom sync engine) terhadap arsitektur yang sudah ada (Tauri +
tauri-plugin-sql + SQLite lokal, migrasi manual via `include_str!`),
skala data kecil (~7700 baris, <1MB), dan strategi LWW yang sudah
diputuskan:

| Kriteria | Turso/libSQL Sync | PowerSync | Custom Sync Engine |
|---|---|---|---|
| Effort integrasi ke arsitektur sekarang | Sedang-Tinggi (ganti driver DB dari sqlx ke libsql) | Tinggi (wajib tambah Postgres) | Sedang (tambah 1 tabel log + service kecil, skema lama utuh) |
| Biaya untuk skala ini | Gratis (jauh di bawah limit free tier) | Gratis (tapi tier lebih mahal jika naik: $49/bln) | Gratis (Cloudflare Workers+D1) |
| Kematangan/risiko proyek | Sedang — libSQL stabil tapi "legacy path"; Turso Database (pengganti) masih pre-1.0, arah masih berubah | Tinggi — produk mapan, tapi arsitekturnya fundamental tidak pas untuk kasus ini | Rendah risiko tooling (primitif umum: HTTP+SQLite), risiko sepenuhnya di maintenance kode sendiri |
| Kemudahan LWW via `updated_at` | Perlu custom logic di atas conflict API (tidak built-in per kolom) | Built-in tapi per-field bukan per-row; custom LWW butuh server hook | Paling mudah — kontrol penuh logikanya |
| Kesiapan untuk mobile | Baik (engine embeddable, sama di semua platform) | Baik tapi terikat butuh backend Postgres | Baik (relay HTTP generik, platform-agnostic) |

**Keputusan final: Custom Sync Engine + Cloudflare Workers/D1** (lihat
alasan detail di "Keputusan desain" di atas).

## Yang BELUM diputuskan (perlu dibahas sebelum/selama eksekusi)

- [ ] Desain konkret skema `change_log`/`sync_log` — kolom apa saja
      (table name, row id, operasi, payload, timestamp, device_id),
      dan apakah dicatat via trigger SQLite atau manual di tiap
      titik INSERT/UPDATE/DELETE di kode aplikasi.
- [ ] Desain endpoint Cloudflare Worker (push/pull) — bentuk request/
      response, autentikasi (walau single-user, tetap perlu proteksi
      supaya endpoint tidak terbuka publik tanpa kontrol).
- [ ] Provisioning: satu D1 database untuk semua device milik user yang
      sama — bagaimana device kedua "menemukan"/terhubung ke database
      yang benar (mis. token/kunci yang di-input manual sekali saat
      setup device baru).
- [ ] Cara & tempat generate/simpan `device_id` stabil per install
      (tabel `settings` vs OS keychain vs lainnya) — belum diputuskan
      detail teknisnya, baru keputusan "disertakan dari awal".

## Todo list eksekusi

### Tahap 0 — Riset & keputusan final — SELESAI, termasuk rename dokumen

- [x] Bandingkan Turso vs PowerSync vs custom sync engine secara
      konkret — **custom sync engine + Cloudflare Workers/D1** dipilih.
- [x] Putuskan strategi DELETE — **soft delete**.
- [x] Putuskan kebutuhan `device_id` — **disertakan dari awal**.
- [x] Putuskan pemicu sync — **saat app dibuka dan online**.

### Tahap 1 — Skema: siapkan kolom pendukung sync

- [ ] Audit semua tabel: mana yang SUDAH punya `updated_at`, mana yang
      belum (mirip audit `created_at` di migrasi UUID kemarin).
- [ ] Migrasi tambah `updated_at` ke tabel yang belum punya.
- [ ] Migrasi tambah `deleted_at` (soft delete) ke tabel yang bisa
      dihapus user.
- [ ] Migrasi tambah `device_id` ke semua tabel yang tersentuh sync.
- [ ] Tabel baru `change_log`/`sync_log` lokal (desain kolom — lihat
      "Yang BELUM diputuskan").
- [ ] Tabel/kolom `settings` untuk simpan `device_id` stabil + cursor/
      checkpoint sync terakhir.

### Tahap 2 — Kode: pastikan `updated_at`/log selalu ter-set benar

- [ ] Audit SEMUA titik `UPDATE` di `src/` (pola sama seperti audit
      `INSERT` di migrasi UUID — grep manual, JANGAN cuma andalkan
      compiler, karena `updated_at` yang lupa di-set adalah bug diam
      yang tidak akan ketahuan dari `tsc`/`cargo check`).
      Ingat temuan kemarin: 8 titik INSERT nyaris lolos karena
      compiler tidak type-check terhadap skema real — kemungkinan
      besar pola yang sama berlaku untuk UPDATE + `updated_at`.
- [ ] Audit semua titik `DELETE`, ganti jadi
      `UPDATE ... SET deleted_at = ?`, dan pastikan semua query SELECT
      yang relevan menambahkan `WHERE deleted_at IS NULL`.
- [ ] Pasang pencatatan ke `change_log` di setiap titik
      INSERT/UPDATE/DELETE(soft) yang relevan.

### Tahap 3 — Server relay (Cloudflare Workers + D1)

- [ ] Setup project Cloudflare Workers + D1, provisioning database.
- [ ] Desain & buat endpoint push (terima perubahan dari device,
      simpan/relay ke device lain).
- [ ] Desain & buat endpoint pull (kirim perubahan sejak checkpoint
      terakhir device yang meminta).
- [ ] Autentikasi sederhana antar device-ke-server (lihat "Yang BELUM
      diputuskan").

### Tahap 4 — Integrasi klien (Rust/Tauri)

- [ ] Generate & simpan `device_id` sekali per install.
- [ ] Logic sync saat app start + online: pull dulu, lalu push
      perubahan lokal yang belum terkirim (termasuk carry-over dari
      sesi sebelumnya kalau sempat offline).
- [ ] Terapkan last-write-wins saat menerima data dari pull:
      bandingkan `updated_at` incoming vs lokal per baris, baris yang
      lebih baru menang.
- [ ] Update checkpoint sync lokal setelah push/pull berhasil.

### Tahap 5 — Verifikasi

- [ ] Uji skenario: edit baris SAMA di 2 device offline berbeda waktu,
      pastikan versi dengan `updated_at` lebih baru yang menang setelah
      sync.
- [ ] Uji skenario: baris baru dibuat di 2 device offline (harus AMAN
      berkat UUID, tidak ada tabrakan id).
- [ ] Uji skenario offline murni: kedua device tetap 100% bisa dipakai
      tanpa internet sama sekali (constraint utama dari
      `multi-device-sync.md`, JANGAN sampai regresi).
- [ ] Uji skenario soft delete: baris dihapus di satu device, device
      lain yang sempat UPDATE baris itu sebelum tahu terhapus tetap
      bisa di-resolve dengan benar via timestamp.

## Terkait

- `docs/todos/done/uuid-migration.md` — prasyarat, SUDAH SELESAI.
- `docs/todos/plan/multi-device-sync.md` — ide awal, latar belakang
  lengkap kenapa sync ini dibutuhkan.
- `docs/todos/plan/mcp-server-for-claude.md` — MENUNGGU sync ini
  selesai duluan sebelum bisa mulai (integrasi Claude Web butuh titik
  akses data terpusat, yang baru ada setelah sync ini jalan).
