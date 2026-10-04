import type { McpServer } from "@modelcontextprotocol/server";
import { registerGetAccountBalances } from "./get-account-balances";
import { registerCreateAccount } from "./create-account";
import { registerUpdateAccount } from "./update-account";
import { registerDeleteAccount } from "./delete-account";
import { registerCorrectAccountBalance } from "./correct-account-balance";

export function registerAccountsMcpTools(server: McpServer) {
  registerGetAccountBalances(server);
  registerCreateAccount(server);
  registerUpdateAccount(server);
  registerDeleteAccount(server);
  registerCorrectAccountBalance(server);
}
