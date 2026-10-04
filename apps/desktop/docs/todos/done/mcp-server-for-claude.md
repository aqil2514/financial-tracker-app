# MCP Server: Ekspos Data Keuangan ke Claude Web

> **Update (2026-09-29): Opsi 2 (Turso + Vercel) DIPILIH, riset teknis
> konkret sudah dilakukan** — lihat bagian "Setup Turso + MCP server —
> riset lanjutan" di bawah untuk detail: model data Turso (embedded
> replica, 1-database-per-user), batasan free tier terverifikasi, DAN
> contoh kode kerja NYATA ditemukan di repo `portofolio` (`mcp-handler` +
> Next.js App Router) yang bisa dicontoh langsung. Bagian di atas ini
> (opsi A/B, constraint offline-first) TETAP VALID sebagai keputusan
> tingkat tinggi — bagian baru di bawah melengkapi dengan detail
> implementasi.

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

## Setup Turso + MCP server — riset lanjutan (2026-09-29)

Sesi diskusi lanjutan (bukan implementasi — murni riset/tanya-jawab)
setelah opsi 2 (Turso + Vercel) condong dipilih. Semua poin di bawah
sudah diverifikasi ke sumber asli (npm, kode paket, repo nyata), BUKAN
sekadar diingat dari training — detail cara verifikasi disebut per
poin supaya bisa dicek ulang kalau perlu.

### Turso — konsep dasar, KENAPA cocok untuk aplikasi ini

Turso = layanan cloud berbasis **libSQL** (fork SQLite untuk kebutuhan
terdistribusi/edge), BUKAN Postgres seperti Supabase — beda filosofi
mendasar, bukan cuma beda mesin SQL:

- **Supabase/Postgres** = model klien-server klasik, satu database
  pusat jadi SATU-SATUNYA sumber kebenaran, semua device WAJIB online
  ke server itu untuk baca/tulis.
- **Turso/libSQL** = model **embedded replica** — tiap device (desktop,
  HP) punya SALINAN LOKAL PENUH (file SQLite biasa) yang bisa
  baca/tulis LANGSUNG tanpa nunggu jaringan, lalu sinkron dua arah ke
  server pusat di background. Ini SAMA PERSIS filosofi `financial-app`
  sekarang (SQLite lokal, offline-first) — Turso cuma menambah
  kemampuan sinkronisasi ke device lain, TIDAK mengubah filosofi dasar.

### `user_id` — TIDAK WAJIB, terpisah total dari soal Turso/offline-first

Pertanyaan yang muncul: "kalau pakai Turso + offline-first, berarti ada
`user_id` di skema?" — **jawaban: tidak, dua hal ini independen.**
`user_id` di kolom tabel cuma dibutuhkan kalau SATU DATABASE dipakai
BERSAMA oleh LEBIH DARI SATU ORANG (multi-tenant, pola Supabase/Postgres
biasa). Untuk Turso, pola yang lebih natural justru **1 database Turso
PER USER** (bukan 1 database besar + kolom `user_id` sebagai pembeda):

- Kamu sendiri, banyak device (desktop+HP) — 1 Turso database, SEMUA
  device-mu autentikasi ke database yang SAMA lewat token yang
  setara. Device beda, `user_id` tetap TIDAK PERLU (masalah replikasi
  bukan masalah identitas).
- Kalau nanti didistribusikan ke orang lain — tiap orang dapat Turso
  database SENDIRI (dibuat otomatis saat mereka setup), BUKAN
  1 database besar dicampur `user_id`. Separasi user terjadi di level
  INFRASTRUKTUR (database mana), bukan level baris data — ini
  MENGHINDARI migrasi skema `user_id` mahal yang dibahas di
  `multi-device-sync.md` (lihat bagian "Masalah konkret... AUTOINCREMENT"
  di sana, migrasi UUID TETAP perlu untuk kasus multi-device, tapi
  `user_id` tetap tidak perlu).

### Batasan Turso free tier — diverifikasi LANGSUNG dari dashboard user (2026-09-29)

Sebelumnya cuma dicatat dari `turso.tech/pricing` (`multi-device-sync.md`)
— sesi ini diverifikasi ULANG dari screenshot dashboard `app.turso.tech`
nyata milik user (akun `aqil2514`), angka SAMA/konsisten:

| Limit | Free tier |
|---|---|
| Databases | **100** |
| Storage | 5GB |
| Monthly Rows Read | 500 Juta |
| Monthly Rows Written | 10 Juta |
| Monthly Syncs | 3GB |

**PENTING — limit ini digabung untuk SELURUH akun, BUKAN per-database.**
Kalau pola "1 database per user" dipakai sampai 100 user, ke-100
database itu BERBAGI kuota storage/read/write/sync yang sama di atas —
BUKAN tiap user dapat jatah 5GB/dst sendiri-sendiri. Jadi "100 database"
itu betul mengizinkan hingga 100 user SECARA JUMLAH, tapi kuota
pemakaian gabungan (bukan jumlah user) yang jadi batas sesungguhnya
kalau makin banyak user aktif. Untuk skala personal/portofolio
(bukan produk komersial banyak user aktif), ini kemungkinan besar
tetap sangat longgar — dasar perhitungan sama seperti yang sudah ada
di `multi-device-sync.md` (`finance.db` user ~741KB utk 7700+
transaksi).

**Provisioning database BUKAN manual via dashboard** — Turso punya
**Platform API** (HTTP, diautentikasi API token) untuk membuat database
secara terprogram. Alurnya: user aktifkan sync di app → **backend
sendiri** (bukan langsung dari device user — token rahasia TIDAK BOLEH
ditanam di client) panggil Turso Platform API "buatkan database utk
user ini" → Turso balas kredensial (URL + token) → dikirim ke device →
dipakai utk sinkronisasi. **Ini SALAH SATU alasan kenapa tetap butuh
"server perantara"**, bukan cuma murni untuk kebutuhan MCP.

### MCP server itu SENDIRI — bukan jembatan pasif, tapi kumpulan tools dgn logic nyata

Koreksi penting dari asumsi awal ("server cuma jembatan tipis"): MCP
BUKAN satu endpoint generik "terusin query" — dia kumpulan **tools**
dengan skema masing-masing (persis seperti daftar
`mcp__claude_ai_Warung_Aqil__*` yang dipakai sesi Claude Code ini
sendiri: `get_ar_ap`, `get_cashflow_summary`, dst — tiap tool punya
nama/deskripsi/parameter/logic query SENDIRI). Jadi MCP server
`financial-app` berarti MENULIS tool satu per satu (`get_account_balances`,
`get_debt_summary`, `get_transaction_summary`, dst) — logic query-nya
SETARA dengan layer `shared/*/use-*.ts` yang sudah dibangun di app
desktop, cuma dijalankan di server (baca dari Turso) bukan di client
React (baca dari SQLite lokal). Scope-nya TUMBUH BERTAHAP — mulai dari
sedikit tool, tambah lebih banyak nanti, sama seperti MCP Retailku
sendiri tumbuh jadi 90+ tools bertahap, BUKAN dirancang lengkap dari
awal.

### Vercel vs VPS gabung Retailku — keputusan DIPERKUAT (bukan diubah)

Dengan pemahaman baru bahwa MCP ini scope-nya akan TUMBUH terus, argumen
Vercel (opsi B di atas) makin kuat, BUKAN melemah:

1. Server bisnis Retailku (2 user berbayar nyata) risikonya makin tidak
   sepadan kalau MCP personal yang menempel di situ terus bertambah
   fitur/query dari waktu ke waktu.
2. Serverless (nyala saat dipanggil, mati setelah selesai) COCOK dgn
   pola tiap tool call MCP — biasanya 1 query singkat ke Turso, bukan
   proses yang perlu hidup terus.
3. Isolasi source code — MCP `financial-app` jadi codebase independen
   dgn siklus hidup sendiri, tidak tercampur ke basis kode Retailku yg
   siklus deploy/risikonya beda total.
4. Biaya sama-sama Rp0 — bukan trade-off finansial.

**Kesimpulan: tetap Vercel Hobby**, sesuai rekomendasi lama di atas.

### Implementasi teknis — `mcp-handler` (Vercel), BUKAN `@modelcontextprotocol/server` mentah

Awalnya dieksplorasi pakai SDK resmi `@modelcontextprotocol/server` v2
(`createMcpHandler` dari situ, diverifikasi nyata via `npm view` — versi
2.2.0, maintainer termasuk staff Anthropic) — TAPI kemudian ditemukan
**contoh kerja NYATA sudah ada** di repo `portofolio` (proyek lain milik
user, `D:\Programming\Pribadi\portofolio\web\src\app\api\mcp\route.ts`)
yang pakai package BERBEDA: **`mcp-handler`** (`npm view` dikonfirmasi:
v2.2.0, dari `github.com/vercel/mcp-handler`, dibuat VERCEL SENDIRI
khusus utk integrasi MCP+Next.js — bukan SDK MCP generik). Ini package
yang LEBIH TEPAT dipakai utk `financial-app` MCP server, karena:

- Sudah terbukti bekerja (bukan cuma dokumentasi/API reference) — ada
  implementasi produksi nyata milik user sendiri utk dicontoh langsung.
- Dirancang spesifik utk pola Next.js App Router + Vercel (`bin:
  create-mcp-route` bahkan ada CLI scaffolding-nya).

**Pola nyata dari `portofolio/web/src/app/api/mcp/route.ts`** (dibaca
langsung, BUKAN dari dokumentasi):

```typescript
import { createMcpHandler } from "mcp-handler";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs"; // bukan edge — dependency (rate limit) butuh Node runtime

const handler = createMcpHandler((server) => {
  server.registerTool(
    "list_projects",       // nama tool
    {
      title: "List Projects",
      description: "...",  // WAJIB jelas, ini yang dibaca Claude utk tahu kapan/bgmn pakai tool
      inputSchema: z.object({ category: z.string().optional() }),
    },
    async ({ category }) => {
      // logic query di sini, return { content: [{ type: "text", text: JSON.stringify(data) }] }
    },
  );
  // ...tool lain, register satu per satu
}, {
  serverInfo: { name: "aqil-portfolio", version: "1.0.0" },
});

export async function GET(req: NextRequest) { return handler(req); }
export async function POST(req: NextRequest) { return handler(req); }
```

**Yang PERLU ditambah untuk `financial-app` (BEDA dari portofolio karena
data finansial itu privat, portofolio publik)**:
1. **Autentikasi/API key** — portofolio TIDAK PUNYA ini sama sekali
   (datanya memang publik) — `financial-app` WAJIB tambah lapisan cek
   token sebelum `handler` dipanggil, `mcp-handler`/MCP SDK TIDAK
   melakukan verifikasi token otomatis (cuma pass-through kalau ada).
2. **Koneksi ke Turso** — portofolio baca dari CMS (Sanity, dugaan dari
   nama fungsi `getProjectsData`/dst), `financial-app` akan baca dari
   Turso client (libSQL client, belum diriset detail cara pakainya
   dari sisi Node/Vercel — PR lanjutan).
3. Rate limiting (`@upstash/ratelimit` + `@upstash/redis`, pola
   `withRateLimit` di kode portofolio) — POLA INI BISA DICONTOH LANGSUNG,
   infrastruktur terpisah dari Turso (Upstash Redis, bukan database
   utama), murni utk cegah penyalahgunaan/spam request.

**Yang BELUM diverifikasi/diputuskan (PR lanjutan sebelum implementasi)**:
- Skema autentikasi persis (API key sederhana vs OAuth) — belum
  diputuskan, "Wajib di kedua opsi" di atas cuma bilang salah satu.
- Cara koneksi libSQL client dari Vercel function ke Turso — belum
  diriset detail (package `@libsql/client`, cara autentikasi ke Turso
  dari server, dst).
- Daftar tool MCP pertama yang mau dibangun (mulai dari mana — saldo
  akun? ringkasan piutang/utang? cashflow?) — belum diputuskan prioritas.
- Detail provisioning otomatis (Platform API Turso dari backend) —
  baru dibahas konsepnya, belum ada kode/desain endpoint.

## Catatan

Opsi teknis (Opsi 2: Turso + Vercel + `mcp-handler`) SUDAH condong
dipilih dan diriset cukup dalam (lihat bagian di atas), TAPI belum ada
SATU BARIS KODE implementasi ditulis di `financial-app` sendiri untuk
fitur ini — sesi ini murni diskusi/riset, ditulis di sini supaya tidak
hilang. Lanjutkan dari daftar "belum diverifikasi/diputuskan" di atas
sebelum mulai coding. Berkaitan erat dengan `multi-device-sync.md`
(Turso jadi tooling yang sama-sama relevan utk KEDUA kebutuhan — sync
multi-device DAN MCP server ini — lihat catatan silang di kedua
dokumen).

> **Update (2026-09-30, sesi lain)**: Turso DITOLAK sbg tooling final
> (lihat `multi-device-sync-engine.md`, riset perbandingan konkret —
> ganti driver DB, LWW tidak built-in, roadmap masih pre-1.0). DAN
> "sync multi-device dulu, baru MCP" (urutan Opsi 2 di dokumen ini)
> ternyata TIDAK PERLU — desktop belum final, mobile belum dibangun
> sama sekali, jadi sync dua-arah beneran belum relevan. Insight baru:
> MCP server SAJA (tanpa sync dua-arah) cukup dengan **push satu-arah
> PC → Cloudflare D1** (PC tetap satu-satunya penulis, tidak ada
> conflict yang mungkin terjadi). Rencana konkret dan lebih sederhana
> ada di **`mcp-server-cloud-mirror.md`** — DOKUMEN ITU yang jadi
> rencana aktif sekarang utk MCP server, bagian di atas (opsi A/B,
> riset Turso) tetap disimpan sbg sejarah keputusan tapi SUDAH TIDAK
> jadi arah yang dipakai.
