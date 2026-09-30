# Struktur modul: controller, service, schema per resource

## Aturan

Tiap resource (`transactions`, `accounts`, `debts`, dst) punya folder
sendiri di `src/modules/<nama>/`, isinya dipecah 3 file berdasarkan
tanggung jawab:

```
src/modules/transactions/
├── controller.ts   ← handle HTTP: parse request, panggil service, bentuk Response
├── service.ts      ← logic bisnis + panggil D1
└── schema.ts        ← tipe payload + validator bentuk data
```

`src/index.ts` HANYA jadi router — daftar `if (url.pathname === ...)`
yang mendelegasikan ke `controller.ts` modul yang sesuai, TIDAK ADA
logic apa pun di situ selain routing.

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

`controller.ts` — HANYA orkestrasi HTTP, tidak ada logic bisnis:

```typescript
import type { Env } from "../../shared/env";
import { isAuthorized } from "../../shared/auth";
import { isPushTransactionPayload } from "./schema";
import { insertTransaction } from "./service";

export async function handlePostTransaction(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!isPushTransactionPayload(body)) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  await insertTransaction(env, body);
  return Response.json({ status: "ok", id: body.id }, { status: 201 });
}
```

`src/index.ts` — router murni:

```typescript
import { handlePostTransaction } from "./modules/transactions/controller";

if (url.pathname === "/transactions" && request.method === "POST") {
  return handlePostTransaction(request, env);
}
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

## Routing: manual if/else, BUKAN router library

Diputuskan 2026-09-30: tetap `if (url.pathname === ...)` manual di
`index.ts`, TIDAK pakai `itty-router`/`Hono`/dst. Alasan: jumlah modul
masih kecil (<10-an), belum butuh path dinamis (`/transactions/:id`)
— tambah dependency baru belum sepadan manfaatnya di skala ini. Kalau
nanti kebutuhan routing jadi kompleks (banyak path dinamis, nested
routes), pertimbangkan ulang keputusan ini, JANGAN dianggap final
selamanya.

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

- `apps/worker/docs/todos/plan/cloud-sync.md` — progress implementasi,
  daftar modul yang sudah/belum ada.
- `apps/desktop/docs/todos/plan/mcp-server-business-logic-audit.md` —
  checklist logic bisnis yang di-port ke `service.ts` tiap modul.
