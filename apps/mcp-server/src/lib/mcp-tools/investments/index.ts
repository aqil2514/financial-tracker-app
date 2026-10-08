import type { McpServer } from "@modelcontextprotocol/server";
import { registerGetInvestmentSummary } from "./get-investment-summary";
import { registerGetInvestmentDetail } from "./get-investment-detail";
import { registerSettleInvestmentSale } from "./settle-investment-sale";
import { registerDeletePendingInvestmentSale } from "./delete-pending-investment-sale";
import { registerCreateInvestmentPurchaseDirect } from "./create-investment-purchase-direct";
import { registerWriteOffInvestment } from "./write-off-investment";

export function registerInvestmentsMcpTools(server: McpServer) {
  registerGetInvestmentSummary(server);
  registerGetInvestmentDetail(server);
  registerSettleInvestmentSale(server);
  registerDeletePendingInvestmentSale(server);
  registerCreateInvestmentPurchaseDirect(server);
  registerWriteOffInvestment(server);
}
