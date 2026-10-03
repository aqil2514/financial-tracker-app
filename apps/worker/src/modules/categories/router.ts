import { Hono } from "hono";
import type { AppContext } from "../../shared/auth";
import { requireAuth } from "../../shared/auth";
import {
  handlePostCategory,
  handlePatchCategory,
  handleDeleteCategory,
} from "./controller";

export const categoriesRouter = new Hono<AppContext>();

categoriesRouter.use(requireAuth);
categoriesRouter.post("/", handlePostCategory);
categoriesRouter.patch("/:id", handlePatchCategory);
categoriesRouter.delete("/:id", handleDeleteCategory);
