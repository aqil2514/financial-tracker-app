import { Hono } from "hono";
import type { AppContext } from "../../shared/auth";
import { requireAuth } from "../../shared/auth";
import {
  handlePostInvestmentAccountPush,
  handlePostInvestmentPurchasePush,
  handleDeleteInvestmentPurchasePush,
  handlePostInvestmentSalePush,
  handleDeleteInvestmentSalePush,
  handlePostInvestmentSaleSettle,
  handleDeleteInvestmentSale,
} from "./controller";

// Modul ini mendukung PEMBELIAN + PENJUALAN investasi penuh (docs/todos/
// plan/investment-sync.md Tahap 2).
//
// Endpoint /accounts/push, /purchases/push(/:id), /sales/push(/:id) adalah
// jalur PUSH (upsert-by-id murni) -- desktop SUDAH punya jalur tulis
// lokalnya sendiri (apply-investment-transaction.ts, apply-sell-investment-
// transaction.ts), sama pola dgn /debts/push. TIDAK ada endpoint "direct
// create" spt POST /debts -- investment_accounts/investment_purchases
// lahir SELALU dari form lokal desktop, tidak ada jalur MCP/langsung yg
// membuatnya tanpa lewat desktop (BELUM, bisa menyusul kalau dibutuhkan).
//
// Endpoint /sales/:id/settle DAN DELETE /sales/:id BUKAN jalur push --
// keduanya aksi UI langsung (tombol "Settle"/"Hapus" di riwayat penjualan,
// lihat SalesHistoryTable desktop) yang Worker SENDIRI insert/hapus
// datanya (bukan upsert-by-id dari baris yang desktop sudah buat).
export const investmentsRouter = new Hono<AppContext>();

investmentsRouter.use(requireAuth);
investmentsRouter.post("/accounts/push", handlePostInvestmentAccountPush);
investmentsRouter.post("/purchases/push", handlePostInvestmentPurchasePush);
investmentsRouter.delete("/purchases/push/:id", handleDeleteInvestmentPurchasePush);
investmentsRouter.post("/sales/push", handlePostInvestmentSalePush);
investmentsRouter.delete("/sales/push/:id", handleDeleteInvestmentSalePush);
investmentsRouter.post("/sales/:id/settle", handlePostInvestmentSaleSettle);
investmentsRouter.delete("/sales/:id", handleDeleteInvestmentSale);
