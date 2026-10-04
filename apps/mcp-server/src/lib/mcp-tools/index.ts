import type { McpServer } from "@modelcontextprotocol/server";
import { registerAccountsMcpTools } from "./accounts";
import { registerTransactionsMcpTools } from "./transactions";
import { registerDebtsMcpTools } from "./debts";
import { registerContactsMcpTools } from "./contacts";
import { registerCategoriesMcpTools } from "./categories";
import { registerAccountGroupsMcpTools } from "./account-groups";

export function registerAllMcpTools(server: McpServer) {
  registerAccountsMcpTools(server);
  registerTransactionsMcpTools(server);
  registerDebtsMcpTools(server);
  registerContactsMcpTools(server);
  registerCategoriesMcpTools(server);
  registerAccountGroupsMcpTools(server);
}
