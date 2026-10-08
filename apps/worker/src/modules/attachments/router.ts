import { Hono } from "hono";
import type { AppContext } from "../../shared/auth";
import { requireAuth } from "../../shared/auth";
import {
  handlePostAttachment,
  handleGetAttachment,
  handleListAttachments,
  handleDeleteAttachment,
} from "./controller";

export const attachmentsRouter = new Hono<AppContext>();

attachmentsRouter.use(requireAuth);
attachmentsRouter.post("/", handlePostAttachment);
attachmentsRouter.get("/", handleListAttachments);
attachmentsRouter.get("/:id", handleGetAttachment);
attachmentsRouter.delete("/:id", handleDeleteAttachment);
