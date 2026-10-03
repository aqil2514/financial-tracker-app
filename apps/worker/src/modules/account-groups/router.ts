import { Hono } from "hono";
import type { AppContext } from "../../shared/auth";
import { requireAuth } from "../../shared/auth";
import {
  handlePostAccountGroup,
  handlePatchAccountGroup,
  handleDeleteAccountGroup,
} from "./controller";

export const accountGroupsRouter = new Hono<AppContext>();

accountGroupsRouter.use(requireAuth);
accountGroupsRouter.post("/", handlePostAccountGroup);
accountGroupsRouter.patch("/:id", handlePatchAccountGroup);
accountGroupsRouter.delete("/:id", handleDeleteAccountGroup);
