import { Hono } from "hono";
import type { AppContext } from "../../shared/auth";
import { requireAuth } from "../../shared/auth";
import { handleGetSync } from "./controller";

export const syncRouter = new Hono<AppContext>();

syncRouter.use(requireAuth);
syncRouter.get("/", handleGetSync);
