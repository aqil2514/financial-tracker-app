import { Hono } from "hono";
import type { Env } from "../../shared/env";
import { requireAuth } from "../../shared/auth";
import {
  handlePostContact,
  handlePatchContact,
  handleDeleteContact,
} from "./controller";

export const contactsRouter = new Hono<{ Bindings: Env }>();

contactsRouter.use(requireAuth);
contactsRouter.post("/", handlePostContact);
contactsRouter.patch("/:id", handlePatchContact);
contactsRouter.delete("/:id", handleDeleteContact);
