import { Hono } from "hono";
import type { AppContext } from "../../shared/auth";
import { requireAuth } from "../../shared/auth";
import {
  handlePostForexAccountPush,
  handlePostForexPurchasePush,
  handleDeleteForexPurchasePush,
  handlePostForexSalePush,
  handleDeleteForexSalePush,
  handlePostForexPurchase,
  handlePostForexSale,
} from "./controller";

// Modul valas (docs/todos/plan/forex-sync.md). Dua kelompok endpoint, pola sama modul investments:
//
// - /accounts/push, /purchases/push(/:id), /sales/push(/:id): jalur PUSH upsert-by-id murni. Klien (desktop,
//   mobile) sudah punya jalur tulis lokalnya sendiri, Worker menerima apa adanya.
// - POST /purchases dan POST /sales: jalur TULIS, Worker sendiri membuat transaksi plus baris riwayat. Untuk
//   klien tanpa jalur tulis lokal (mis. MCP). Transaksi valas lewat /transactions dari sumber non-PC ditolak,
//   lihat validateForexTransactionAllowed.
export const forexRouter = new Hono<AppContext>();

forexRouter.use(requireAuth);
forexRouter.post("/accounts/push", handlePostForexAccountPush);
forexRouter.post("/purchases/push", handlePostForexPurchasePush);
forexRouter.delete("/purchases/push/:id", handleDeleteForexPurchasePush);
forexRouter.post("/sales/push", handlePostForexSalePush);
forexRouter.delete("/sales/push/:id", handleDeleteForexSalePush);
forexRouter.post("/purchases", handlePostForexPurchase);
forexRouter.post("/sales", handlePostForexSale);
