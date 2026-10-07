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
  unit: z
    .number()
    .optional()
    .describe(
      "Jumlah unit investasi -- WAJIB diisi utk transfer cash<->investment. Arah jual (investment->cash) WAJIB dibarengi pricePerUnit; arah beli (cash->investment) opsional (order pending boleh belum tahu unit pasti)."
    ),
  pricePerUnit: z
    .number()
    .optional()
    .describe(
      "Harga per unit investasi saat transaksi ini -- WAJIB diisi utk arah jual (investment->cash), opsional utk arah beli."
    ),
  investmentStatus: z
    .enum(["pending", "settled"])
    .optional()
    .describe(
      "Status settlement baris investment_purchases/investment_sales -- default 'pending'. Arah jual (investment->cash) via tool ini SELALU dipaksa 'settled' oleh Worker (jual 'pending' tanpa transaksi apa pun hanya bisa lewat endpoint khusus, belum ada tool MCP-nya)."
    ),
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
