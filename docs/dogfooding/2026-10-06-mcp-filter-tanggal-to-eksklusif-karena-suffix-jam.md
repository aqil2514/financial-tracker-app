# Filter `to` di 4 tool MCP salah mengecualikan transaksi bertanggal `to` itu sendiri

Bug ditemukan saat mengecek via MCP apakah data production hari ini
(2026-10-06) sudah tersinkron ke D1 — `list_transactions` dengan
`from=2026-10-06` DAN `to=2026-10-06` (dua-duanya tanggal yang sama)
mengembalikan array KOSONG, padahal ada 7 transaksi di tanggal itu
(dikonfirmasi lewat `wrangler d1 execute --remote` langsung ke D1
production).

## Bagaimana ketahuan

1. `list_transactions({from: "2026-10-06", to: "2026-10-06"})` → `[]`
2. `list_transactions({from: "2026-10-06"})` (tanpa `to`) → 7 transaksi,
   semua bertanggal 2026-10-06 — jadi `from` sendirian benar.
3. `list_transactions({to: "2026-10-06"})` (tanpa `from`) → mengembalikan
   transaksi tanggal **2026-10-05**, bukan 2026-10-06 — `to` sendirian
   salah, mengecualikan tanggal yang seharusnya termasuk.

## Root cause

`Transaction.date` TIDAK konsisten formatnya di data nyata — kadang
`"YYYY-MM-DD"` polos (transaksi tanpa jam spesifik), kadang
`"YYYY-MM-DDTHH:mm"` (dengan jam, mis. `"2026-10-06T18:04"`). Filter
`from`/`to` dari user SELALU `"YYYY-MM-DD"` (sesuai `inputSchema` tiap
tool, format wajib).

`apps/mcp-server/src/lib/sync-snapshot.ts` (sebelum fix) membandingkan
string APA ADANYA:

```ts
if (options.to && t.date > options.to) continue;
```

Perbandingan string leksikografis: `"2026-10-06T18:04" > "2026-10-06"`
adalah **TRUE** (string yang lebih panjang dengan prefix sama dianggap
"lebih besar") — jadi SEMUA transaksi ber-jam pada tanggal `to` itu
sendiri ikut di-`continue` (dikecualikan), padahal tanggalnya sama
persis dengan batas akhir yang diminta. Kombinasi `from === to` (kasus
paling umum: "transaksi hari ini") jadi himpunan kosong karena semua
transaksi hari itu (yang hampir selalu punya jam) gagal lolos filter
`to`.

Filter `from` (`t.date < options.from`) KEBETULAN tidak kena bug ini —
`"2026-10-06T18:04" < "2026-10-06"` adalah **FALSE** (string lebih
panjang dgn prefix sama tetap "lebih besar", jadi `<` otomatis salah,
transaksi tetap lolos) — jadi filter `from` sendirian terlihat bekerja
benar, cuma `to` yang nyata-nya rusak.

## Scope: 4 tool MCP terdampak

Pola `t.date > options.to`/`t.date <= options.to` (atau variannya)
dipakai di 4 fungsi berbeda, masing-masing dipanggil 1 tool:

| Tool MCP | Fungsi | Dampak |
|---|---|---|
| `list_transactions` | `listTransactions` | `to` opsional — rusak kalau diisi |
| `get_expense_summary_by_category` | `summarizeExpenseByCategory` | `to` opsional — rusak kalau diisi |
| `get_cashflow_breakdown` | `summarizeCashflow` | `to` opsional — rusak kalau diisi |
| `get_balance_trend` | `computeBalanceTrend` | `to` **WAJIB** diisi — SELALU kena, bukan cuma edge case |

`get_balance_trend` paling berisiko karena `to` wajib di schema-nya
(bukan opsional seperti 3 tool lain) — setiap pemanggilan tool ini
kemungkinan salah mengecualikan transaksi di tanggal akhir yang punya
jam, bukan cuma saat `from === to`.

## Fix

Tambah helper `datePart()` (ambil 10 karakter pertama — `"YYYY-MM-DD"`
dari string apa pun formatnya) di `sync-snapshot.ts`, lalu bandingkan
`datePart(t.date)` terhadap `options.from`/`options.to` di keempat
lokasi (termasuk filter `from` yang kebetulan tidak rusak — diikutkan
juga demi konsistensi dan menghindari kerusakan serupa kalau format
`date` berubah lagi nanti):

```ts
function datePart(date: string): string {
  return date.slice(0, 10);
}
```

Diverifikasi: `tsc --noEmit` bersih di `apps/mcp-server`. Tidak ada test
runner terpasang di proyek ini (`package.json` cuma punya
`dev`/`build`/`start`/`typecheck`) — jadi tidak ada suite otomatis utk
regresi fungsional, cuma verifikasi tipe. Perubahan ini BELUM dideploy
(masih di working tree lokal per commit terakhir) — butuh deploy ulang
Vercel (`apps/mcp-server`) sebelum fix ini aktif di client MCP
sungguhan (Claude Web/HP).
