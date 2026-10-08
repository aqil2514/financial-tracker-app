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
  handlePostInvestmentPurchaseDirect,
  handlePostInvestmentWriteOff,
} from "./controller";

// Modul ini mendukung PEMBELIAN + PENJUALAN investasi penuh (docs/todos/
// plan/investment-sync.md Tahap 2).
//
// Endpoint /accounts/push, /purchases/push(/:id), /sales/push(/:id) adalah
// jalur PUSH (upsert-by-id murni) -- desktop SUDAH punya jalur tulis
// lokalnya sendiri (apply-investment-transaction.ts, apply-sell-investment-
// transaction.ts), sama pola dgn /debts/push.
//
// Endpoint /sales/:id/settle DAN DELETE /sales/:id BUKAN jalur push --
// keduanya aksi UI langsung (tombol "Settle"/"Hapus" di riwayat penjualan,
// lihat SalesHistoryTable desktop) yang Worker SENDIRI insert/hapus
// datanya (bukan upsert-by-id dari baris yang desktop sudah buat).
//
// Endpoint /purchases/direct DAN /write-off (ditambahkan 2026-10-08, lihat
// docs/concept/konsep-investasi.md "Unit yang berubah TANPA transfer kas")
// pola PERSIS POST /debts (createDirectDebt) & POST /debts/:id/write-off
// (writeOffDebt) -- Worker SENDIRI insert transaksi income/expense +
// baris investment_purchases/investment_sales, dipanggil LANGSUNG dari
// MCP tanpa harus lewat desktop sama sekali.
export const investmentsRouter = new Hono<AppContext>();

investmentsRouter.use(requireAuth);
investmentsRouter.post("/accounts/push", handlePostInvestmentAccountPush);
investmentsRouter.post("/purchases/push", handlePostInvestmentPurchasePush);
investmentsRouter.delete("/purchases/push/:id", handleDeleteInvestmentPurchasePush);
investmentsRouter.post("/purchases/direct", handlePostInvestmentPurchaseDirect);
investmentsRouter.post("/sales/push", handlePostInvestmentSalePush);
investmentsRouter.delete("/sales/push/:id", handleDeleteInvestmentSalePush);
investmentsRouter.post("/sales/:id/settle", handlePostInvestmentSaleSettle);
investmentsRouter.delete("/sales/:id", handleDeleteInvestmentSale);
investmentsRouter.post("/write-off", handlePostInvestmentWriteOff);
