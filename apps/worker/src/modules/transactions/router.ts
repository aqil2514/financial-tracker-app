import { Hono } from "hono";
import type { Env } from "../../shared/env";
import { requireAuth } from "../../shared/auth";
import { handlePostTransaction } from "./controller";

export const transactionsRouter = new Hono<{ Bindings: Env }>();

transactionsRouter.use(requireAuth);
transactionsRouter.post("/", handlePostTransaction);
