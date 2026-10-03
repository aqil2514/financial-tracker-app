import { Hono } from "hono";
import type { AppContext } from "../../shared/auth";
import { requireAuth } from "../../shared/auth";
import {
  handlePostAccount,
  handlePatchAccount,
  handleGetAccountBalance,
  handlePostCorrectBalance,
  handleDeleteAccount,
} from "./controller";

export const accountsRouter = new Hono<AppContext>();

accountsRouter.use(requireAuth);
accountsRouter.post("/", handlePostAccount);
accountsRouter.patch("/:id", handlePatchAccount);
accountsRouter.get("/balance", handleGetAccountBalance);
accountsRouter.post("/correct-balance", handlePostCorrectBalance);
accountsRouter.delete("/:id", handleDeleteAccount);
