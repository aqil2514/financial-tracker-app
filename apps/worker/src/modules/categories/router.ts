import { Hono } from "hono";
import type { Env } from "../../shared/env";
import { requireAuth } from "../../shared/auth";
import { handlePostCategory, handlePatchCategory } from "./controller";

export const categoriesRouter = new Hono<{ Bindings: Env }>();

categoriesRouter.use(requireAuth);
categoriesRouter.post("/", handlePostCategory);
categoriesRouter.patch("/:id", handlePatchCategory);
