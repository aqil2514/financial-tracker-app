import type { McpServer } from "@modelcontextprotocol/server";
import { registerGetThirdPartySummary } from "./get-third-party-summary";
import { registerGetThirdPartyDetail } from "./get-third-party-detail";
import { registerCreateThirdPartyFundDirect } from "./create-third-party-fund-direct";

export function registerThirdPartyMcpTools(server: McpServer) {
  registerGetThirdPartySummary(server);
  registerGetThirdPartyDetail(server);
  registerCreateThirdPartyFundDirect(server);
}
