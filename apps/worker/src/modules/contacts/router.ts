import { Hono } from "hono";
import type { AppContext } from "../../shared/auth";
import { requireAuth } from "../../shared/auth";
import {
  handlePostContact,
  handlePatchContact,
  handleDeleteContact,
} from "./controller";

export const contactsRouter = new Hono<AppContext>();

contactsRouter.use(requireAuth);
contactsRouter.post("/", handlePostContact);
contactsRouter.patch("/:id", handlePatchContact);
contactsRouter.delete("/:id", handleDeleteContact);
