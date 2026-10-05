import type { McpServer } from "@modelcontextprotocol/server";
import { registerGetAccountBalances } from "./get-account-balances";
import { registerCreateAccount } from "./create-account";
import { registerUpdateAccount } from "./update-account";
import { registerDeleteAccount } from "./delete-account";
import { registerCorrectAccountBalance } from "./correct-account-balance";
import { registerGetCashflowBreakdown } from "./get-cashflow-breakdown";
import { registerGetBalanceTrend } from "./get-balance-trend";

export function registerAccountsMcpTools(server: McpServer) {
  registerGetAccountBalances(server);
  registerCreateAccount(server);
  registerUpdateAccount(server);
  registerDeleteAccount(server);
  registerCorrectAccountBalance(server);
  registerGetCashflowBreakdown(server);
  registerGetBalanceTrend(server);
}
