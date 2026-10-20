import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { dateField } from "@/lib/date-field";

// Port dari correctDebtRemaining (desktop, apps/desktop/src/shared/debts/
// correct-debt-remaining.ts) lewat Worker POST /debts/:id/correct-remaining
// (apps/worker/src/modules/debts/service.ts correctDebtRemaining) --
// koreksi granular per baris `debts`, BEDA dari correct_account_balance
// yang menolak TOTAL akun bertipe 'debt' (saldo akun itu derived dari
// data piutang/utang, bukan nilai bebas). Worker menghitung diff dari
// sisa saat ini, membuat transaksi penutup + menyesuaikan
// debts/debt_payments sendiri -- tool ini cuma kirim sisa TARGET.
export function registerCorrectDebtRemaining(server: McpServer) {
  server.registerTool(
    "correct_debt_remaining",
    {
      title: "Koreksi Sisa Piutang/Utang",
      description:
        "Koreksi sisa sebuah piutang/utang (debts.id) ke nominal yang seharusnya, dengan membuat transaksi penyesuaian otomatis. Gunakan ini bukan correct_account_balance kalau yang mau dikoreksi adalah piutang/utang spesifik (bukan saldo akun 'debt' secara keseluruhan, yang ditolak karena derived dari data ini). Arah naik maupun turun ditangani otomatis dari selisihnya.",
      inputSchema: z.object({
        debtId: z.string().describe("ID piutang/utang (debts.id) yang dikoreksi"),
        targetRemaining: z.number().min(0).describe("Sisa yang SEHARUSNYA sekarang, bukan selisihnya"),
        date: dateField,
        note: z.string().describe("Alasan koreksi, mis. 'salah input nominal awal'"),
      }),
    },
    async ({ debtId, ...rest }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/debts/${debtId}/correct-remaining`, {
        method: "POST",
        body: JSON.stringify(rest),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
