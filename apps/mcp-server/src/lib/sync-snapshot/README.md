# `sync-snapshot`

Sisi **baca** tool MCP (`list_*`, `get_*`, `summarize_*`): sekali `fetchFullSnapshot` ambil hasil `GET /sync` dari Worker, semua agregasi/filter dihitung in-memory dari snapshot itu — bukan query HTTP terpisah per tool. Sisi tulis (create/update/delete) tidak lewat sini, langsung `workerFetch` ke endpoint CRUD per-domain di Worker.

## Struktur

- `types.ts` — semua type row (`Account`, `Transaction`, dst) + `SyncSnapshot` + `fetchFullSnapshot`.
- `shared.ts` — helper lintas-entitas (`isAlive`, `datePart`, `buildNameLookups`), dipakai banyak fungsi di `entities/`.
- `entities/` — satu subfolder per entitas (`accounts`, `categories`, `transactions`, `debts`, `investments`, `category-periods`), satu file per fungsi. Fungsi yang bergantung ke entitas lain tetap "dimiliki" entitas utamanya dan import lintas folder (contoh: `investments/get-investment-holding.ts` import `computeAccountBalance` dari `accounts/`). Tiap subfolder punya `README.md` sendiri yang menjelaskan maksud tiap file.
- `entities/index.ts` — barrel, re-export semua type dan fungsi. Konsumen (`mcp-tools/*`) import dari sini (`@/lib/sync-snapshot/entities`), bukan dari file individual.

## `types.ts`

Type `SyncSnapshot` duplikat SENGAJA dari bentuk response `/sync` di `apps/worker/src/modules/sync/service/index.ts` — tidak ada package bersama lintas-app, jadi harus di-update manual kalau bentuk response `/sync` berubah di Worker.

## `shared.ts`

- `isAlive` — baris belum soft-deleted (`deletedAt` null).
- `datePart` — ambil 10 karakter pertama tanggal. `Transaction.date` TIDAK konsisten formatnya: kadang `"YYYY-MM-DD"` polos, kadang `"YYYY-MM-DDTHH:mm"` (dengan jam). Filter `from`/`to` dari user SELALU `"YYYY-MM-DD"` tanpa jam. Perbandingan string apa adanya (`"2026-10-06T18:04" <= "2026-10-06"`) salah — string yang lebih panjang berprefix sama dianggap "lebih besar" secara leksikografis, jadi transaksi ber-jam pada tanggal `to` itu sendiri salah tereksklusi. `datePart` menormalkan dulu supaya perbandingan selalu tanggal-vs-tanggal, bukan tanggal-vs-datetime.
- `buildNameLookups` — resolve ID mentah (`accountId`, `categoryId`, `contactId`) ke nama. Dipakai tool-tool "get"/"list" supaya caller tidak perlu lookup manual via `get_account_balances` dulu tiap kali baca transaksi/debt.
- `buildLabelNameLookup` — resolve ID entitas (transaksi/kategori/akun) ke daftar nama label yang menempel padanya, lewat tabel junction many-to-many (`transactionLabels`/`categoryLabels`/`accountLabels`). Generik terhadap bentuk junction row mana pun selama punya `labelId`+`deletedAt`, dan caller kirim `entityIdOf` buat ambil ID entitas pemiliknya (`transactionId`/`categoryId`/`accountId`). Dipakai `list_transactions`, `list_categories`, `get_account_balances` supaya `labelNames` ikut dalam satu panggilan, tidak perlu panggilan kedua ke tool label terpisah.

## Label belum lengkap di semua tool

`SyncSnapshot` sudah bawa 4 entitas label (`labels`, `transactionLabels`, `categoryLabels`, `accountLabels`), tapi baru diterapkan ke 3 tool di atas. Tool baca lain yang menampilkan transaksi/kategori/akun (misal `get_contact_history`, `get_debt_detail`, `get_category_period_summary`) belum menyertakan `labelNames` — tambahkan `buildLabelNameLookup` ke tool itu kalau memang dibutuhkan.
