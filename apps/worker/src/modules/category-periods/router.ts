import { Hono } from "hono";
import type { AppContext } from "../../shared/auth";
import { requireAuth } from "../../shared/auth";
import {
  handlePostCategoryPeriodPush,
  handleDeleteCategoryPeriodPush,
  handleGetCategoryPeriodSummary,
} from "./controller";

export const categoryPeriodsRouter = new Hono<AppContext>();

categoryPeriodsRouter.use(requireAuth);
categoryPeriodsRouter.post("/push", handlePostCategoryPeriodPush);
categoryPeriodsRouter.delete("/push/:id", handleDeleteCategoryPeriodPush);
categoryPeriodsRouter.get("/:id/summary", handleGetCategoryPeriodSummary);
