# Cloud Sync + MCP Server — Index Navigasi

> Index navigasi utk SATU fitur lintas-app spesifik (cloud sync +
> kelola data keuangan dari HP via Claude). Lihat
> [`../README.md`](../README.md) utk penjelasan umum struktur
> `docs/todos/{plan,done}/` di root repo — folder ini bisa berisi
> rencana lintas-app LAIN di masa depan, bukan cuma topik ini.

Index ini HANYA navigasi + checklist ringkas. Detail keputusan desain,
riset, dan progress implementasi ada di dokumen masing-masing app —
JANGAN duplikasi isi ke sini, cukup pointer.

## Cloud sync + MCP server (kelola data keuangan dari HP via Claude)

Fitur lintas-app: `apps/desktop` (PC) ↔ `apps/worker` (Cloudflare,
satu-satunya penulis D1) ↔ `apps/mcp-server` (Vercel, jembatan ke
Claude — live, sisi BACA selesai).

- [x] **Tahap 0-1** — Riset arsitektur & keputusan conflict resolution
      — **SELESAI**. Detail:
      [`apps/worker/docs/todos/plan/cloud-sync.md`](../../../apps/worker/docs/todos/plan/cloud-sync.md)
- [x] **Tahap 2** — Audit logic bisnis yang wajib direplikasi ke Worker
      — **SELESAI** (audit + porting, 7 dari 7 logic). Detail:
      [`apps/desktop/docs/todos/plan/mcp-server-business-logic-audit.md`](../../../apps/desktop/docs/todos/plan/mcp-server-business-logic-audit.md)
- [x] **Tahap 3** — Skema kolom sync (`updated_at`/`deleted_at`/`sync_source`)
      — **SELESAI** di kedua sisi (PC + D1), termasuk checkpoint sync PC.
      Detail sisi PC:
      [`apps/desktop/docs/todos/plan/mcp-server-cloud-mirror.md`](../../../apps/desktop/docs/todos/plan/mcp-server-cloud-mirror.md) —
      Detail sisi D1:
      [`apps/worker/docs/todos/plan/cloud-sync.md`](../../../apps/worker/docs/todos/plan/cloud-sync.md)
- [x] **Tahap 4** — Worker: endpoint sync + tulis + validasi bisnis +
      autentikasi — **SELESAI** (2026-10-03, termasuk token MCP
      terpisah). Worker live di production
      (`https://financial-app-worker.muhamadaqil383.workers.dev`).
      Logic bisnis: 7 dari 7 ter-port & diverifikasi end-to-end.
      Endpoint CRUD LENGKAP utk `transactions` (create, update, **DELETE
      dgn penanganan khusus piutang/utang terkait** — lihat
      `docs/concept/konsep-utang-piutang.md`), `accounts`,
      `account_groups`, `categories`, `contacts`. Semua endpoint tulis
      UPSERT dgn LWW beneran. Autentikasi: `PC_SYNC_TOKEN` (PC↔Worker)
      DAN `MCP_SYNC_TOKEN` (Worker↔mcp-server) terpisah, `GET
      /auth/verify` utk validasi token ringan. **SENGAJA SKIP** endpoint
      `/debts`/`/debt-payments` langsung (tidak py padanan create/update
      di desktop). Detail:
      [`apps/worker/docs/todos/plan/cloud-sync.md`](../../../apps/worker/docs/todos/plan/cloud-sync.md)
- [ ] **Tahap 5** — MCP server (Vercel + `mcp-handler`) — **SEBAGIAN
      SELESAI** (2026-10-03): `apps/mcp-server` live di Vercel, OAuth
      shim custom, 5 tool BACA (saldo akun, ringkasan pengeluaran per
      kategori, daftar transaksi, ringkasan utang-piutang, riwayat per
      kontak) — **diverifikasi via client MCP sungguhan** (Claude Web,
      bukan simulasi). **BELUM**: tool TULIS (daftar final belum
      diputuskan) — tanpa ini, "kelola data dari HP" masih sebatas
      "lihat data dari HP". Detail:
      [`apps/worker/docs/todos/plan/cloud-sync.md`](../../../apps/worker/docs/todos/plan/cloud-sync.md)
- [x] **Tahap 6** — Integrasi klien PC (toggle Settings, hook push
      on-write, pull saat app dibuka, retry queue, backfill) —
      **SELESAI secara fungsional** (2026-10-01), diverifikasi dua arah
      di production nyata. Detail:
      [`apps/desktop/docs/todos/plan/mcp-server-cloud-mirror.md`](../../../apps/desktop/docs/todos/plan/mcp-server-cloud-mirror.md)
- [ ] **Tahap 7** — Verifikasi end-to-end (sisi Worker/MCP) — **BELUM
      DIMULAI**, terblokir sampai tool TULIS MCP (Tahap 5 lanjutan) ada
      — butuh skenario tulis dari HP yang realistis (konflik,
      soft-delete cross-device), bukan simulasi satu sisi.

## Gap aktif (per 2026-10-03)

1. **Tool TULIS di `apps/mcp-server`** — pekerjaan terbesar yang
   tersisa. Tanpa ini, tujuan awal "kelola data keuangan dari HP" belum
   genap (baru bisa "lihat", belum bisa "ubah"). Prasyarat: keputusan
   `sync_source` dinamis per token (saat ini beberapa endpoint Worker
   spt `correct-balance` masih hardcode `'mcp'`).
2. **Tahap 7** (verifikasi konflik nyata + soft-delete cross-device) —
   menunggu poin 1.
3. **25 transaksi historis** yang ditolak aturan validasi Worker — sadar
   dibiarkan terbuka (divergence historis diterima, bukan bug).

**Dokumen historis/rujukan** (tidak perlu dibaca kecuali menelusuri
alasan suatu keputusan): `apps/desktop/docs/todos/plan/mcp-server-for-claude.md`
(riset paling awal), `apps/desktop/docs/todos/plan/multi-device-sync-engine.md`
(rencana TERPISAH untuk `apps/mobile` native nanti, disimpan untuk
masa depan — bukan bagian dari fitur MCP ini).
