import { Hono } from "hono";
import type { AppContext } from "../../shared/auth";
import { requireAuth } from "../../shared/auth";
import {
  handlePostInvestmentAccountPush,
  handlePostInvestmentPurchasePush,
  handleDeleteInvestmentPurchasePush,
} from "./controller";

// Modul ini BARU mendukung PEMBELIAN investasi (docs/todos/plan/
// investment-sync.md Tahap 2) -- penjualan/penarikan sebagian
// (investment_sales, average cost, Realized P/L) BELUM diport, lihat
// catatan di service.ts.
//
// Semua endpoint di sini adalah jalur PUSH (upsert-by-id murni) --
// desktop SUDAH punya jalur tulis lokalnya sendiri (apply-investment-
// transaction.ts), sama pola dgn /debts/push. TIDAK ada endpoint "direct
// create" spt POST /debts -- investment_accounts/investment_purchases
// lahir SELALU dari form lokal desktop (form akun investasi, form
// transaksi/"Catat Pembelian"), tidak ada jalur MCP/langsung yg
// membuatnya tanpa lewat desktop (BELUM, bisa menyusul kalau
// dibutuhkan).
export const investmentsRouter = new Hono<AppContext>();

investmentsRouter.use(requireAuth);
investmentsRouter.post("/accounts/push", handlePostInvestmentAccountPush);
investmentsRouter.post("/purchases/push", handlePostInvestmentPurchasePush);
investmentsRouter.delete("/purchases/push/:id", handleDeleteInvestmentPurchasePush);
