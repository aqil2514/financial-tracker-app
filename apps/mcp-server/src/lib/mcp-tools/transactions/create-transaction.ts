import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken, newId } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { dateField } from "@/lib/date-field";

export const transactionFields = {
  type: z.enum(["income", "expense", "transfer"]),
  amount: z.number().positive(),
  note: z.string(),
  date: dateField,
  categoryId: z.string().optional(),
  accountId: z.string().min(1, "Akun wajib diisi").describe("Akun sumber/utama, wajib diisi"),
  transferAccountId: z.string().optional().describe("Akun tujuan, wajib diisi utk type=transfer"),
  description: z.string().optional(),
  contactId: z.string().optional().describe("ID kontak, menang kalau diisi bareng contactName"),
  contactName: z
    .string()
    .optional()
    .describe("Nama kontak bahasa natural, di-resolve Worker (get-or-create) kalau contactId kosong"),
  debtAction: z
    .enum(["settlement", "payable"])
    .optional()
    .describe("Wajib diisi kalau transfer dari akun debt ke akun cash (ambigu pelunasan vs utang baru)"),
  settleDebtIds: z
    .array(z.string())
    .optional()
    .describe("ID piutang/utang yang dilunasi, hanya dipakai saat debtAction=settlement"),
};

export function registerCreateTransaction(server: McpServer) {
  server.registerTool(
    "create_transaction",
    {
      title: "Catat Transaksi",
      description:
        "Catat transaksi baru (income/expense/transfer). Untuk catat/bayar piutang-utang, gunakan type=transfer dengan accountId/transferAccountId yang melibatkan akun bertipe debt, plus debtAction & settleDebtIds kalau perlu.",
      inputSchema: z.object(transactionFields),
    },
    async (args, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, "/transactions", {
        method: "POST",
        body: JSON.stringify({ id: newId(), ...args }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
