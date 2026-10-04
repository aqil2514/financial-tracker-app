import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";

// Port dari use-write-off-debt.ts (desktop) lewat Worker POST
// /debts/:id/write-off (apps/worker/src/modules/debts/service.ts
// writeOffDebt) -- tandai piutang/utang 'written_off' (diikhlaskan,
// BUKAN pelunasan). Worker yang hitung sisa & bikin transaksi penutup
// sendiri -- tool ini TIDAK kirim amount/date/note sama sekali, beda
// dari pay_debt_non_cash yang transaksinya memang sebagian/custom.
export function registerWriteOffDebt(server: McpServer) {
  server.registerTool(
    "write_off_debt",
    {
      title: "Hapuskan Piutang/Utang",
      description:
        "Tandai piutang/utang sebagai dihapuskan (diikhlaskan, tidak akan ditagih lagi) -- BUKAN pelunasan. Worker otomatis membuat transaksi penutup sebesar sisa piutang/utang pada akun debt terkait, supaya saldo akun ikut ke nol. Wajib confirm:true. Gagal 422 kalau piutang/utang ini dari sinkronisasi Retailku (belum ada akun debt terkait).",
      inputSchema: z.object({
        debtId: z.string().describe("ID piutang/utang (debts.id) yang dihapuskan"),
        confirm: z.literal(true).describe("Harus true, konfirmasi eksplisit sebelum menghapuskan"),
      }),
    },
    async ({ debtId }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/debts/${debtId}/write-off`, { method: "POST" });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
