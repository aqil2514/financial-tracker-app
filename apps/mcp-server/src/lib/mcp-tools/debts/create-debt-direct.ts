import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken, newId } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

// create_debt_direct & pay_debt_non_cash -- menutup gap paralelitas
// desktop vs MCP (audit-kepatuhan-konsep-tipe-akun.md pertanyaan #7).
// Mode 'transfer'/'cash' SUDAH bisa lewat create_transaction +
// debtAction -- dua tool ini KHUSUS jalur yang belum ada padanannya:
// piutang/utang tanpa transaksi apa pun, dan pelunasan tanpa uang
// berpindah (barter/pemutihan/offset).
export function registerCreateDebtDirect(server: McpServer) {
  server.registerTool(
    "create_debt_direct",
    {
      title: "Catat Piutang/Utang Langsung",
      description:
        "Catat piutang/utang BARU tanpa transaksi kas apa pun -- untuk uang yang sudah berpindah DI LUAR app (pinjam tunai, barter, piutang lama). accountId wajib menunjuk akun bertipe 'debt'. Untuk piutang/utang yang lahir dari transfer kas<->debt, gunakan create_transaction dengan type=transfer.",
      inputSchema: z.object({
        type: z.enum(["receivable", "payable"]).describe("receivable = saya meminjamkan, payable = saya berutang"),
        amount: z.number().positive(),
        accountId: z.string().min(1, "Akun wajib diisi").describe("Akun bertipe 'debt'"),
        date: z.string().describe("Format YYYY-MM-DD"),
        note: z.string().optional(),
        contactId: z.string().optional().describe("ID kontak, menang kalau diisi bareng contactName"),
        contactName: z
          .string()
          .optional()
          .describe("Nama kontak bahasa natural, di-resolve Worker (get-or-create) kalau contactId kosong"),
      }),
    },
    async (args, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, "/debts", {
        method: "POST",
        body: JSON.stringify({ id: newId(), ...args }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
