import type { McpServer } from "@modelcontextprotocol/server";
import { registerListCategoryPeriods } from "./list-category-periods";
import { registerGetCategoryPeriodSummary } from "./get-category-period-summary";
import { registerCreateCategoryPeriod } from "./create-category-period";
import { registerUpdateCategoryPeriod } from "./update-category-period";
import { registerDeleteCategoryPeriod } from "./delete-category-period";

export function registerCategoryPeriodsMcpTools(server: McpServer) {
  registerListCategoryPeriods(server);
  registerGetCategoryPeriodSummary(server);
  registerCreateCategoryPeriod(server);
  registerUpdateCategoryPeriod(server);
  registerDeleteCategoryPeriod(server);
}
