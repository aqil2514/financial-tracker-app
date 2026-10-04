import type { McpServer } from "@modelcontextprotocol/server";
import { registerCreateTransaction } from "./create-transaction";
import { registerUpdateTransaction } from "./update-transaction";
import { registerDeleteTransaction } from "./delete-transaction";
import { registerListTransactions } from "./list-transactions";
import { registerGetExpenseSummaryByCategory } from "./get-expense-summary-by-category";

export function registerTransactionsMcpTools(server: McpServer) {
  registerCreateTransaction(server);
  registerUpdateTransaction(server);
  registerDeleteTransaction(server);
  registerListTransactions(server);
  registerGetExpenseSummaryByCategory(server);
}
