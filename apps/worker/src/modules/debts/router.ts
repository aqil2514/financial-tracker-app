import { Hono } from "hono";
import type { AppContext } from "../../shared/auth";
import { requireAuth } from "../../shared/auth";
import { handlePostDebt, handlePostDebtPayment, handlePostDebtWriteOff } from "./controller";

export const debtsRouter = new Hono<AppContext>();

debtsRouter.use(requireAuth);
debtsRouter.post("/", handlePostDebt);
debtsRouter.post("/:id/payments", handlePostDebtPayment);
debtsRouter.post("/:id/write-off", handlePostDebtWriteOff);
