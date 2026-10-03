import { Hono } from "hono";
import type { AppContext } from "../../shared/auth";
import { requireAuth } from "../../shared/auth";
import { handlePostTransaction, handlePatchTransaction, handleDeleteTransaction } from "./controller";

export const transactionsRouter = new Hono<AppContext>();

transactionsRouter.use(requireAuth);
transactionsRouter.post("/", handlePostTransaction);
transactionsRouter.patch("/:id", handlePatchTransaction);
transactionsRouter.delete("/:id", handleDeleteTransaction);
