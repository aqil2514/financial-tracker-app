import type { McpServer } from "@modelcontextprotocol/server";
import { registerGetDebtSummary } from "./get-debt-summary";
import { registerGetDebtDetail } from "./get-debt-detail";
import { registerCreateDebtDirect } from "./create-debt-direct";
import { registerPayDebtNonCash } from "./pay-debt-non-cash";
import { registerWriteOffDebt } from "./write-off-debt";
import { registerCorrectDebtRemaining } from "./correct-debt-remaining";

export function registerDebtsMcpTools(server: McpServer) {
  registerGetDebtSummary(server);
  registerGetDebtDetail(server);
  registerCreateDebtDirect(server);
  registerPayDebtNonCash(server);
  registerWriteOffDebt(server);
  registerCorrectDebtRemaining(server);
}
