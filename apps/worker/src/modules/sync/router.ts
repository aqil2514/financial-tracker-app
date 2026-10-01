import { Hono } from "hono";
import type { Env } from "../../shared/env";
import { requireAuth } from "../../shared/auth";
import { handleGetSync } from "./controller";

export const syncRouter = new Hono<{ Bindings: Env }>();

syncRouter.use(requireAuth);
syncRouter.get("/", handleGetSync);
