# `entities/investments`

Fungsi baca yang dimiliki entitas investasi (`investmentAccounts`, `investmentPurchases`, `investmentSales`), dihitung dari `SyncSnapshot` (hasil `/sync` Worker), bukan query SQL terpisah.

## `get-average-cost-per-unit.ts`

`getAverageCostPerUnit` — port PERSIS dari `investment-holding-math.ts` (desktop) dan `apps/worker/.../investments/service.ts`. SATU-SATUNYA rumus average cost, dipakai validasi oversell (`getRemainingUnit`) DAN tampilan ringkasan. Cuma baris `status='settled'` yang ikut dihitung (baris pending belum pasti unit/harganya).

## `get-remaining-unit.ts`

`getRemainingUnit` — port PERSIS `getRemainingUnit`: sisa unit yang BISA DIJUAL (validasi oversell), BEDA dari `totalUnit` di `getInvestmentHolding` (yang mengikutkan pembelian pending, basis Unrealized P/L). Penjualan pending SUDAH dikurangi (optimis, simetris pembelian).

## `get-investment-holding.ts`

`getInvestmentHolding` — port PERSIS `InvestmentPlStats` (desktop). Unrealized P/L dihitung dari `balance` akun (modal posisi aktif, live dari transactions via `computeAccountBalance`), BUKAN average cost × remainingUnit. `totalUnit` di sini SUM SEMUA pembelian (termasuk pending yang unit-nya terisi) — basis BEDA dari `getRemainingUnit` (yang cuma settled), lihat komentar `investment-pl-stats.tsx` desktop soal kenapa dua "total unit" ini sengaja berbeda.

## `summarize-investments.ts`

`summarizeInvestments` — ringkasan LINTAS semua akun investment, pola sama `summarizeDebts`, dipakai `get_investment_summary` (tool baru, Tahap 4). Realized P/L dihitung dari SELURUH `investment_sales` berstatus settled (snapshot permanen saat settle, lihat `apply-sell-investment-transaction.ts`), tanpa filter tanggal — cermin halaman `/investments` ringkasan desktop.

## `list-investment-detail.ts`

`listInvestmentDetail` — riwayat lot (pembelian + penjualan) satu akun investment, pola sama `listDebtDetails`, dipakai `get_investment_detail` (tool baru, Tahap 4).
