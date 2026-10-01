import { Hono } from "hono";
import type { Env } from "../../shared/env";
import { requireAuth } from "../../shared/auth";
import {
  handlePostAccountGroup,
  handlePatchAccountGroup,
  handleDeleteAccountGroup,
} from "./controller";

export const accountGroupsRouter = new Hono<{ Bindings: Env }>();

accountGroupsRouter.use(requireAuth);
accountGroupsRouter.post("/", handlePostAccountGroup);
accountGroupsRouter.patch("/:id", handlePatchAccountGroup);
accountGroupsRouter.delete("/:id", handleDeleteAccountGroup);
