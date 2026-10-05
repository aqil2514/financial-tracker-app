import { Hono } from "hono";
import type { AppContext } from "../../shared/auth";
import { requireAuth } from "../../shared/auth";
import {
  handlePostDebt,
  handlePostDebtPayment,
  handlePostDebtWriteOff,
  handlePostDebtPush,
  handlePostDebtPaymentPush,
  handleDeleteDebtPush,
  handleDeleteDebtPaymentPush,
} from "./controller";

export const debtsRouter = new Hono<AppContext>();

debtsRouter.use(requireAuth);
debtsRouter.post("/", handlePostDebt);
debtsRouter.post("/:id/payments", handlePostDebtPayment);
debtsRouter.post("/:id/write-off", handlePostDebtWriteOff);
// Upsert-by-id MURNI utk baris desktop sudah buat sendiri (source-based
// ownership) -- path TERPISAH dari "/" (handlePostDebt) yg SELALU bikin
// transaksi closing. Lihat docs/todos/plan/fix-debts-duplikasi-sync.md.
debtsRouter.post("/push", handlePostDebtPush);
debtsRouter.post("/payments/push", handlePostDebtPaymentPush);
// Soft-delete baris debts/debt_payments yg PC hapus lokal sbg bagian
// dari RECREATE (edit field berbahaya) -- gap ditemukan 2026-10-05 lewat
// test manual (baris lama menumpuk tanpa ini). TERPISAH dari
// DELETE /transactions/:id.
debtsRouter.delete("/push/:id", handleDeleteDebtPush);
debtsRouter.delete("/payments/push/:id", handleDeleteDebtPaymentPush);
