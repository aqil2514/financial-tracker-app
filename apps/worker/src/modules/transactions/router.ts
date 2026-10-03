import { Hono } from "hono";
import type { Env } from "../../shared/env";
import { requireAuth } from "../../shared/auth";
import { handlePostTransaction, handlePatchTransaction, handleDeleteTransaction } from "./controller";

export const transactionsRouter = new Hono<{ Bindings: Env }>();

transactionsRouter.use(requireAuth);
transactionsRouter.post("/", handlePostTransaction);
transactionsRouter.patch("/:id", handlePatchTransaction);
transactionsRouter.delete("/:id", handleDeleteTransaction);
