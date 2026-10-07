import type { McpServer } from "@modelcontextprotocol/server";
import { registerGetInvestmentSummary } from "./get-investment-summary";
import { registerGetInvestmentDetail } from "./get-investment-detail";
import { registerSettleInvestmentSale } from "./settle-investment-sale";
import { registerDeletePendingInvestmentSale } from "./delete-pending-investment-sale";

export function registerInvestmentsMcpTools(server: McpServer) {
  registerGetInvestmentSummary(server);
  registerGetInvestmentDetail(server);
  registerSettleInvestmentSale(server);
  registerDeletePendingInvestmentSale(server);
}
