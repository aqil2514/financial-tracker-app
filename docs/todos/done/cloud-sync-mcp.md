# Cloud Sync + MCP Server — Index Navigasi

> Index navigasi utk SATU fitur lintas-app spesifik (cloud sync +
> kelola data keuangan dari HP via Claude). Lihat
> [`../README.md`](../README.md) utk penjelasan umum struktur
> `docs/todos/{plan,done}/` di root repo — folder ini bisa berisi
> rencana lintas-app LAIN di masa depan, bukan cuma topik ini.

> **KOREKSI (2026-10-05)**: "apps/worker (satu-satunya penulis D1)" di
> bawah SALAH secara faktual utk `debts`/`debt_payments` — desktop
> SELALU py jalur tulis lokalnya sendiri, menyebabkan bug duplikasi.
> Keputusan dibalik sadar, lihat index
> [`docs/todos/done/fix-debts-duplikasi-sync.md`](../done/fix-debts-duplikasi-sync.md).

Index ini HANYA navigasi + checklist ringkas. Detail keputusan desain,
riset, dan progress implementasi ada di dokumen masing-masing app —
JANGAN duplikasi isi ke sini, cukup pointer.

## Cloud sync + MCP server (kelola data keuangan dari HP via Claude)

Fitur lintas-app: `apps/desktop` (PC) ↔ `apps/worker` (Cloudflare,
satu-satunya penulis D1) ↔ `apps/mcp-server` (Vercel, jembatan ke
Claude — live, sisi BACA selesai).

- [x] **Tahap 0-1** — Riset arsitektur & keputusan conflict resolution
      — **SELESAI**. Detail:
      [`apps/worker/docs/todos/done/cloud-sync.md`](../../../apps/worker/docs/todos/done/cloud-sync.md)
- [x] **Tahap 2** — Audit logic bisnis yang wajib direplikasi ke Worker
      — **SELESAI** (audit + porting, 7 dari 7 logic). Detail:
      [`apps/desktop/docs/todos/done/mcp-server-business-logic-audit.md`](../../../apps/desktop/docs/todos/done/mcp-server-business-logic-audit.md)
- [x] **Tahap 3** — Skema kolom sync (`updated_at`/`deleted_at`/`sync_source`)
      — **SELESAI** di kedua sisi (PC + D1), termasuk checkpoint sync PC.
      Detail sisi PC:
      [`apps/desktop/docs/todos/done/mcp-server-cloud-mirror.md`](../../../apps/desktop/docs/todos/done/mcp-server-cloud-mirror.md) —
      Detail sisi D1:
      [`apps/worker/docs/todos/done/cloud-sync.md`](../../../apps/worker/docs/todos/done/cloud-sync.md)
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
      [`apps/worker/docs/todos/done/cloud-sync.md`](../../../apps/worker/docs/todos/done/cloud-sync.md)
- [x] **Tahap 5** — MCP server (Vercel + `mcp-handler`) — **SELESAI**
      (2026-10-03): `apps/mcp-server` live di Vercel, OAuth shim custom,
      5 tool BACA (saldo akun, ringkasan pengeluaran per kategori,
      daftar transaksi, ringkasan utang-piutang, riwayat per kontak) +
      16 tool TULIS (create/update/delete utk transactions/accounts/
      account_groups/categories/contacts, plus correct_account_balance)
      — total 21 tool. Resolusi nama kontak otomatis (`contactName` →
      `contactId` via Worker), `sync_source` dinamis per token, tool
      `delete_*` wajib `confirm:true`. **Diverifikasi via protokol MCP
      sungguhan di production** (bukan simulasi) — "kelola data dari HP"
      sekarang genap: bisa lihat DAN ubah data. Detail:
      [`apps/worker/docs/todos/done/cloud-sync.md`](../../../apps/worker/docs/todos/done/cloud-sync.md)
- [x] **Tahap 6** — Integrasi klien PC (toggle Settings, hook push
      on-write, pull saat app dibuka, retry queue, backfill) —
      **SELESAI secara fungsional** (2026-10-01), diverifikasi dua arah
      di production nyata. Detail:
      [`apps/desktop/docs/todos/done/mcp-server-cloud-mirror.md`](../../../apps/desktop/docs/todos/done/mcp-server-cloud-mirror.md)
- [x] **Tahap 7** — Verifikasi end-to-end (sisi Worker/MCP) — **DITUTUP
      2026-10-03, keputusan sadar: TIDAK via skenario test formal**.
      Setelah tool TULIS MCP (Tahap 5) selesai, user memutuskan skenario
      konflik/soft-delete cross-device cukup ketahuan lewat dogfooding
      nyata (pakai aplikasinya sehari-hari dari PC+HP), bukan simulasi
      buatan — temuan dicatat manual di `Catatan Penggunaan.txt` (root
      repo) kapan pun muncul, bukan checklist test terpisah.

## Gap aktif (per 2026-10-03)

1. **25 transaksi historis** yang ditolak aturan validasi Worker — sadar
   dibiarkan terbuka (divergence historis diterima, bukan bug).

**Dokumen historis/rujukan** (tidak perlu dibaca kecuali menelusuri
alasan suatu keputusan): `apps/desktop/docs/todos/done/mcp-server-for-claude.md`
(riset paling awal), `apps/desktop/docs/todos/plan/multi-device-sync-engine.md`
(rencana TERPISAH untuk `apps/mobile` native nanti, disimpan untuk
masa depan — bukan bagian dari fitur MCP ini).
