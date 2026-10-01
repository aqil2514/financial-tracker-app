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
Claude — BELUM DIBUAT).

- [ ] **Tahap 0-1** — Riset arsitektur & keputusan conflict resolution
      — **SELESAI**. Detail:
      [`apps/worker/docs/todos/plan/cloud-sync.md`](../../../apps/worker/docs/todos/plan/cloud-sync.md)
- [ ] **Tahap 2** — Audit logic bisnis yang wajib direplikasi ke Worker
      — **AUDIT SELESAI, PORTING BELUM DIMULAI**. Detail:
      [`apps/desktop/docs/todos/plan/mcp-server-business-logic-audit.md`](../../../apps/desktop/docs/todos/plan/mcp-server-business-logic-audit.md)
- [ ] **Tahap 3** — Skema kolom sync (`updated_at`/`deleted_at`/`sync_source`)
      — **SELESAI** di kedua sisi (PC + D1), checkpoint sync PC BELUM.
      Detail sisi PC:
      [`apps/desktop/docs/todos/plan/mcp-server-cloud-mirror.md`](../../../apps/desktop/docs/todos/plan/mcp-server-cloud-mirror.md) —
      Detail sisi D1:
      [`apps/worker/docs/todos/plan/cloud-sync.md`](../../../apps/worker/docs/todos/plan/cloud-sync.md)
- [ ] **Tahap 4** — Worker: endpoint sync + tulis + validasi bisnis +
      autentikasi PC↔Worker — **SEDANG BERJALAN**. Selesai: provisioning
      D1, autentikasi PC↔Worker (token statis Bearer), Worker SUDAH
      DI-DEPLOY ke production
      (`https://financial-app-worker.muhamadaqil383.workers.dev`),
      struktur kode dirapikan jadi per-modul (`controller`/`service`/
      `schema`, lihat `apps/worker/docs/rules/module-structure.md`),
      migrasi routing ke Hono (0 regresi, diverifikasi penuh). **Logic
      bisnis: 7 dari 7 SUDAH di-port & diverifikasi end-to-end di
      production** (2026-10-01) — #1 FIFO debt, #4 larangan
      income/expense di akun debt, #5 formula saldo akun, #6 koreksi
      saldo manual, #2 guard edit, #3 validasi pelunasan ≤ sisa
      (**celah ditutup**, dulu over-alokasi gagal senyap — sekarang
      reject 422 keras sebelum tulis apa pun), #7 `dangerousFieldsChanged`.
      Endpoint yang ada: `transactions` (create + update via `PATCH
      /transactions/:id`), `accounts` (`balance`, `correct-balance`,
      `DELETE`), `account_groups`/`categories`/`contacts` (create +
      update + `DELETE`, SEJAK 2026-10-01 — reassign/unassign eksplisit
      PERSIS pola desktop). **SENGAJA SKIP** endpoint `/debts` &
      `/debt-payments` langsung — tidak py padanan create/update di
      desktop (SELALU lewat `transactions`+`applyDebtTransaction`, sudah
      ter-cover). Belum: `DELETE /transactions/:id` (perlu keputusan
      guard debt/payment dulu); `POST`/`PATCH` utk `accounts` (gap
      terpisah, belum pernah di-port); UPSERT+LWW beneran (semua
      endpoint tulis skrg masih INSERT/UPDATE polos, belum bandingkan
      `updated_at`); token MCP terpisah dari `PC_SYNC_TOKEN`. Detail:
      [`apps/worker/docs/todos/plan/cloud-sync.md`](../../../apps/worker/docs/todos/plan/cloud-sync.md)
- [ ] **Tahap 5** — MCP server (Vercel + `mcp-handler`) — **BELUM
      DIMULAI**, `apps/mcp-server` belum ada. Detail:
      [`apps/worker/docs/todos/plan/cloud-sync.md`](../../../apps/worker/docs/todos/plan/cloud-sync.md)
- [ ] **Tahap 6** — Integrasi klien PC (toggle Settings, hook push
      on-write, pull saat app dibuka) — **BELUM DIMULAI**. Detail:
      [`apps/desktop/docs/todos/plan/mcp-server-cloud-mirror.md`](../../../apps/desktop/docs/todos/plan/mcp-server-cloud-mirror.md)
- [ ] **Tahap 7** — Verifikasi end-to-end — **BELUM DIMULAI**.

**Dokumen historis/rujukan** (tidak perlu dibaca kecuali menelusuri
alasan suatu keputusan): `apps/desktop/docs/todos/plan/mcp-server-for-claude.md`
(riset paling awal), `apps/desktop/docs/todos/plan/multi-device-sync-engine.md`
(rencana TERPISAH untuk `apps/mobile` native nanti, disimpan untuk
masa depan — bukan bagian dari fitur MCP ini).
