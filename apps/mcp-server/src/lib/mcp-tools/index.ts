import type { McpServer } from "@modelcontextprotocol/server";
import { registerAccountsMcpTools } from "./accounts";
import { registerTransactionsMcpTools } from "./transactions";
import { registerDebtsMcpTools } from "./debts";
import { registerContactsMcpTools } from "./contacts";
import { registerCategoriesMcpTools } from "./categories";
import { registerAccountGroupsMcpTools } from "./account-groups";
import { registerInvestmentsMcpTools } from "./investments";
import { registerAttachmentsMcpTools } from "./attachments";

export function registerAllMcpTools(server: McpServer) {
  registerAccountsMcpTools(server);
  registerTransactionsMcpTools(server);
  registerDebtsMcpTools(server);
  registerContactsMcpTools(server);
  registerCategoriesMcpTools(server);
  registerAccountGroupsMcpTools(server);
  registerInvestmentsMcpTools(server);
  registerAttachmentsMcpTools(server);
}
