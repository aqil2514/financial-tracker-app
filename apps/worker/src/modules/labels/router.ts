import { Hono } from "hono";
import type { AppContext } from "../../shared/auth";
import { requireAuth } from "../../shared/auth";
import {
  handlePostLabel,
  handlePatchLabel,
  handleListLabels,
  handleDeleteLabel,
  handleAttachLabel,
  handleDetachLabel,
  handleListEntityLabels,
} from "./controller";

export const labelsRouter = new Hono<AppContext>();

labelsRouter.use(requireAuth);

// Tabel master (dictionary).
labelsRouter.post("/", handlePostLabel);
labelsRouter.get("/", handleListLabels);
labelsRouter.patch("/:id", handlePatchLabel);
labelsRouter.delete("/:id", handleDeleteLabel);

// Attach/detach/list relasi -- :scope = transactions|categories|accounts,
// menentukan junction table mana yg disentuh (lihat service.ts JUNCTION).
labelsRouter.post("/:scope/:entityId", handleAttachLabel);
labelsRouter.delete("/:scope/:entityId/:labelId", handleDetachLabel);
labelsRouter.get("/:scope/:entityId", handleListEntityLabels);
