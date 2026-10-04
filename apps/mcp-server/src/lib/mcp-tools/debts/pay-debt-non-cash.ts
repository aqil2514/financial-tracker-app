import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken, newId } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { dateField } from "@/lib/date-field";

export function registerPayDebtNonCash(server: McpServer) {
  server.registerTool(
    "pay_debt_non_cash",
    {
      title: "Lunasi Piutang/Utang Tanpa Uang",
      description:
        "Lunasi (sebagian/seluruh) piutang/utang TANPA uang berpindah sama sekali -- barter, pemutihan, atau saling-offset. Catat alasannya di note. Untuk pelunasan dengan uang riil, gunakan create_transaction dengan type=transfer dan debtAction=settlement.",
      inputSchema: z.object({
        debtId: z.string().describe("ID piutang/utang (debts.id) yang dilunasi"),
        amount: z.number().positive(),
        date: dateField,
        note: z.string().optional().describe("Alasan pelunasan non-cash, mis. 'barter jasa desain'"),
      }),
    },
    async ({ debtId, ...rest }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/debts/${debtId}/payments`, {
        method: "POST",
        body: JSON.stringify({ id: newId(), ...rest }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
