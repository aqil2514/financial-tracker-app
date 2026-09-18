# MCP Server: Ekspos Data Keuangan ke Claude Web

## Latar belakang

Muncul dari diskusi soal MCP Retailku (90+ tools, sudah live) — pertanyaan
yang diajukan: apakah `financial-app` (aplikasi ini) bisa dibuat jadi MCP
SERVER sendiri, supaya Claude WEB (bukan cuma sesi Claude Code lokal yang
sedang berjalan di repo ini) bisa query data keuangan pribadi secara
langsung — mis. "berapa pengeluaran bulan ini", "saldo semua akun
sekarang".

## Kenapa ini beda dari kasus Retailku

Data aplikasi ini SQLite lokal (`AppData` di PC, lihat
`C:\Users\Windows\AppData\Roaming\com.windows.financial-app\finance.db`)
— cuma ada di satu PC, tidak seperti Retailku yang sudah berupa server
cloud dari awal. MCP server yang mau diakses Claude WEB (bukan Claude
Desktop/Code lokal) HARUS bisa dijangkau lewat internet — MCP transport
`stdio` (yang dipakai kalau MCP client dan server jalan di mesin yang
sama) tidak relevan di sini, harus transport HTTP remote.

## Opsi yang sudah dibahas (belum diputuskan)

**Opsi 1 — PC tetap jadi sumber data, expose lewat tunnel**:
- MCP HTTP server kecil (mis. Rust `axum`, atau proses Node terpisah) baca
  langsung dari SQLite lokal.
- Expose ke internet lewat Cloudflare Tunnel / Tailscale Funnel (BUKAN
  port-forward router langsung — jauh lebih berisiko).
- Trade-off: gratis, tidak perlu database terpisah/sync, TAPI PC harus
  menyala terus supaya bisa diakses Claude web kapan saja.

**Opsi 2 — sync ke database cloud, MCP server terpisah baca dari situ**:
- Data disinkron dari SQLite lokal ke database cloud (kemungkinan Turso,
  lihat `multi-device-sync.md` — kalau multi-device sync sudah dibangun,
  MCP server ini tinggal baca dari Turso yang sama, tidak perlu database
  terpisah lagi).
- MCP server jalan sebagai service cloud — dua opsi hosting konkret sudah
  dibahas (lihat bagian "Opsi hosting" di bawah).
- Trade-off: selalu available tanpa PC harus nyala, TAPI data keuangan
  personal "keluar" dari lokal-only, perlu sync logic.

**Wajib di kedua opsi**: autentikasi kuat sebelum diekspos ke internet —
OAuth 2.0 (pola sama seperti Retailku) atau API key/token sederhana kalau
memang cuma dipakai sendiri. Tanpa ini, siapa pun yang tahu URL server
bisa baca seluruh data keuangan.

## Opsi hosting untuk MCP server (Opsi 2), dua kandidat dibandingkan

**A. Nebeng server Retailku (Biznetgio)** — jalankan MCP server
`financial-app` sebagai proses tambahan di server yang sama dengan
Retailku:
- Biaya tambahan: Rp0 kalau kapasitas server (CPU/RAM) masih longgar.
- Risiko: kalau server Retailku sudah dekat batas resource, nambah
  proses lain bisa mengganggu performa Retailku sendiri — yang melayani
  transaksi bisnis nyata dan 2 paid user berbayar. Risiko operasional
  bisnis demi fitur personal, perlu dipertimbangkan hati-hati kalau
  dipilih.

**B. Vercel Hobby (terpisah total dari Retailku)** — MCP server sebagai
serverless function tersendiri di Vercel:
- Biaya: Rp0. Dicek ke `vercel.com/pricing`/`vercel.com/docs/plans/hobby`
  (September 2026) — Hobby tier: 1 juta function invocations/bulan, 4 jam
  Active CPU/bulan, 360 GB-hours memory, 100GB bandwidth, timeout 60
  detik per function. Untuk trafik personal (query dari Claude, puluhan
  kali/hari), ini sangat longgar — jauh di bawah limit manapun.
- Syarat ToS: "Hobby plan is free but only allowed for personal,
  non-commercial projects" — MCP server catatan keuangan pribadi murni
  (bukan produk komersial) masuk kategori yang diizinkan.
- Keunggulan dibanding Opsi A: terisolasi penuh dari infrastruktur
  Retailku, TIDAK ADA risiko fitur personal mengganggu performa server
  bisnis yang sedang melayani user berbayar.

**Rekomendasi awal**: Vercel Hobby (Opsi B) — sama-sama Rp0, tapi
menghindari risiko operasional Opsi A sama sekali. Konsisten juga dengan
prinsip "online opsional, terpisah dari core" — di sini juga "server
personal terpisah dari server bisnis", bukan bercampur.

## Constraint desain: online harus opsional, bukan wajib

Sama seperti prinsip di `retailku-integration.md` — aplikasi ini
offline-first (Tauri + SQLite lokal), MCP server TIDAK BOLEH mengubah itu.
Server MCP-nya adalah proses TERPISAH yang jalan DI SAMPING aplikasi
utama, bukan bagian yang aplikasi utamanya bergantung padanya untuk bisa
berfungsi:
- Menambah transaksi, lihat laporan, dan semua fitur inti tetap 100%
  jalan tanpa internet, persis seperti sekarang — sama sekali tidak
  berubah oleh keberadaan MCP server ini.
- Kalau PC/server MCP mati atau tidak dinyalakan, dampaknya HANYA fitur
  "tanya Claude web soal data keuangan" yang untuk sementara tidak bisa
  dipakai — bukan aplikasi utamanya ikut terganggu.
- Ini murni fitur tambahan opsional yang menempel di atas data yang sudah
  ada, bukan komponen inti yang wajib selalu hidup.

## Catatan

Baru sebatas ide/arah, belum ada keputusan desain teknis (pilihan opsi,
tooling spesifik, skema autentikasi). Dicatat supaya idenya tidak hilang
— pembahasan teknis lebih lanjut ditunda sampai relevan untuk dikerjakan.
Kemungkinan berkaitan dengan `retailku-integration.md` (integrasi jangka
menengah dengan Retailku) tapi ini topik terpisah — MCP server di sini
untuk Claude langsung, bukan untuk Retailku.
