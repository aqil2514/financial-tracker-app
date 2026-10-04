# Struktur modul: controller, service, schema per resource

## Aturan

Tiap resource (`transactions`, `accounts`, `debts`, dst) punya folder
sendiri di `src/modules/<nama>/`, isinya dipecah 4 file berdasarkan
tanggung jawab:

```
src/modules/transactions/
├── router.ts       ← sub-app Hono: daftar path relatif -> controller
├── controller.ts   ← handle HTTP: terima Context Hono, panggil service, bentuk Response
├── service.ts      ← logic bisnis + panggil D1
└── schema.ts        ← tipe payload + validator bentuk data
```

`src/index.ts` HANYA jadi induk Hono — `.route(prefix, subApp)` yang
menempelkan tiap `router.ts` modul ke prefix path-nya (`/transactions`,
`/accounts`, dst), TIDAK ADA logic routing detail atau HTTP handling
apa pun di situ.

Kalau modul TIDAK punya path dinamis dan cuma 1 endpoint sederhana
(mis. `health`), `router.ts` boleh dilewati — daftar langsung di
`index.ts` — TAPI begitu modul itu bertambah endpoint, pindahkan ke
`router.ts` sendiri supaya `index.ts` tetap ringkas.

`src/shared/` isinya yang dipakai LINTAS modul (`env.ts` untuk
interface `Env`, `auth.ts` untuk `isAuthorized()`) — kalau sesuatu
cuma dipakai satu modul, taruh di modul itu sendiri, JANGAN naik ke
`shared/` duluan sebelum benar-benar dipakai ≥2 modul.

## Kenapa dipecah begini

`index.ts` yang menumpuk semua endpoint+logic bisnis+validasi jadi satu
`fetch()` besar (kondisi sebelum refactor 2026-09-30) TIDAK terbaca dan
sulit dirawat begitu jumlah tabel/operasi bertambah — rencana penuh
proyek ini py 7 tabel × beberapa operasi (create/update/delete) ×
validasi bisnis per operasi (lihat
`apps/desktop/docs/todos/plan/mcp-server-business-logic-audit.md`),
polanya akan berulang puluhan kali kalau tetap di satu file.

Pemisahan controller/service juga penting krn **logic bisnis (`service.ts`)
adalah bagian paling kritis & paling perlu diuji** dari seluruh proyek
ini (lihat dokumen audit di atas) — terpisah dari kode HTTP
(`controller.ts`) supaya nanti gampang ditest sendiri tanpa perlu
mock `Request`/`Response`.

## Contoh: modul `transactions`

`schema.ts` — tipe data + validasi BENTUK saja (field ada, tipe benar),
BUKAN validasi bisnis:

```typescript
export type PushTransactionPayload = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  note: string;
  date: string;
  // ...field opsional lain
};

export function isPushTransactionPayload(value: unknown): value is PushTransactionPayload {
  // cek typeof tiap field wajib
}
```

`service.ts` — logic bisnis + akses D1. INI tempat nanti logic dari
`mcp-server-business-logic-audit.md` di-port (FIFO debt, larangan akun
`debt` utk income/expense, formula saldo, dst):

```typescript
import type { Env } from "../../shared/env";
import type { PushTransactionPayload } from "./schema";

export async function insertTransaction(env: Env, payload: PushTransactionPayload): Promise<void> {
  // INSERT/UPDATE ke D1, termasuk validasi bisnis begitu di-port
}
```

`controller.ts` — HANYA orkestrasi HTTP, terima `Context` Hono
langsung (diputuskan 2026-09-30 barengan migrasi ke Hono — konsisten
krn `router.ts` sudah 100% terikat Hono, lebih ringkas drpd extract
`request`/`env` manual di tiap controller):

```typescript
import type { Context } from "hono";
import type { Env } from "../../shared/env";
import { isPushTransactionPayload } from "./schema";
import { insertTransaction } from "./service";

// Autentikasi ditangani requireAuth middleware, dipasang di router.ts
// -- controller TIDAK perlu cek isAuthorized() manual.
export async function handlePostTransaction(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json().catch(() => null);
  if (!isPushTransactionPayload(body)) {
    return c.json({ error: "Invalid payload" }, 400);
  }
  await insertTransaction(c.env, body);
  return c.json({ status: "ok", id: body.id }, 201);
}
```

`router.ts` — sub-app Hono, path RELATIF thd prefix yg ditempel induk.
Autentikasi dipasang SEKALI di sini via `router.use(requireAuth)`
(diputuskan 2026-09-30, REVISI dari cek manual di tiap controller yg
berulang) — kalau cuma SEBAGIAN endpoint dalam satu modul yg butuh
proteksi (belum ada kasusnya per 2026-09-30), pasang per-route:
`router.post("/", requireAuth, handler)`:

```typescript
import { Hono } from "hono";
import type { Env } from "../../shared/env";
import { requireAuth } from "../../shared/auth";
import { handlePostTransaction } from "./controller";

export const transactionsRouter = new Hono<{ Bindings: Env }>();
transactionsRouter.use(requireAuth);
transactionsRouter.post("/", handlePostTransaction);
// nanti: transactionsRouter.patch("/:id", handlePatchTransaction);
```

`src/index.ts` — induk Hono, cuma menempelkan sub-app tiap modul:

```typescript
import { Hono } from "hono";
import type { Env } from "./shared/env";
import { transactionsRouter } from "./modules/transactions/router";
import { accountsRouter } from "./modules/accounts/router";

const app = new Hono<{ Bindings: Env }>();
app.route("/transactions", transactionsRouter);
app.route("/accounts", accountsRouter);

export default app;
```

## Logic bisnis lintas-modul: modul PEMILIK vs modul PEMICU

Sebagian logic (lihat checklist di
`mcp-server-business-logic-audit.md`) DIPICU dari satu modul tapi
mengubah tabel milik modul LAIN — contoh: transaksi `transfer` ke akun
`debt` (dipicu dari `transactions`) yg harus otomatis membuat/mengubah
baris di tabel `debts`.

Aturan: modul yg tabelnya DIUBAH tetap jadi PEMILIK logic itu (ekspor
fungsi dari `service.ts`-nya), modul yg MEMICU cuma memanggil fungsi
itu — TIDAK menduplikasi logic-nya sendiri. Contoh: FIFO debt (logic
#1) dimiliki `debts/service.ts` (mis. `createDebtFromTransfer()`,
`settleDebtsFifo()`), dipanggil dari `transactions/service.ts` saat
insert/update transaksi `transfer` yg menyentuh akun `debt`.

Alasan: satu sumber kebenaran per logic — kalau nanti ada endpoint
`debts` langsung (mis. tool MCP "buat piutang manual" tanpa lewat
transaksi), dia manggil fungsi yg SAMA dari `debts/service.ts`, bukan
menyalin ulang logic FIFO ke tempat lain.

Larangan yg SEPENUHNYA milik satu modul (mis. #4 "larangan income/
expense di akun debt", #7 `dangerousFieldsChanged`) TETAP taruh di
`service.ts` modul itu sendiri (`transactions/service.ts`) — pola
pemicu/pemilik di atas HANYA berlaku kalau tabel yg diubah benar-benar
beda dari modul yg memicu.

## Routing: Hono, sub-app per modul

**REVISI 2026-09-30** (keputusan awal "manual if/else" DIBATALKAN):
begitu path dinamis pertama dibutuhkan (`PATCH /transactions/:id`),
parsing manual via regex mulai rapuh & akan berulang tiap resource baru
— pindah ke `Hono` (`npm install hono` di `apps/worker`).

Pola: tiap modul punya `router.ts` (sub-app Hono, `new Hono<{ Bindings:
Env }>()`, path RELATIF), `index.ts` jadi induk yg `.route(prefix,
subApp)` tiap modul — lihat contoh kode di atas. Path dinamis pakai
syntax `:nama` bawaan Hono (`c.req.param("id")`), TIDAK perlu regex
manual.

Kenapa Hono (bukan `itty-router`/lainnya): dirancang khusus utk edge
runtime (Cloudflare Workers/Deno/Bun), sangat ringan, API `.route()`
utk nested router cocok PERSIS dgn kebutuhan "1 sub-app per modul" di
sini.

## Submodule (kalau satu resource jadi kompleks)

Kalau `service.ts` satu modul membesar signifikan (mis. `transactions`
punya logic create vs update yg sama-sama besar & beda total), boleh
dipecah lagi jadi submodule:

```
src/modules/transactions/
├── create/
│   ├── controller.ts
│   ├── service.ts
│   └── schema.ts
├── update/
│   ├── controller.ts
│   ├── service.ts
│   └── schema.ts
└── ...
```

Belum ada kasus nyata yg butuh ini per 2026-09-30 (semua modul masih
satu operasi) — dicatat sbg pola yg BOLEH dipakai nanti, bukan
struktur wajib dari awal.

## Terkait

- `apps/worker/docs/todos/done/cloud-sync.md` — progress implementasi,
  daftar modul yang sudah/belum ada.
- `apps/desktop/docs/todos/plan/mcp-server-business-logic-audit.md` —
  checklist logic bisnis yang di-port ke `service.ts` tiap modul.
