import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken, newId } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { dateField } from "@/lib/date-field";

// Pola PERSIS write_off_debt -- unit investasi hilang/dilepas TANPA kas
// yang berpindah (hibah ke orang lain, delisting/perusahaan bangkrut,
// biaya admin dipotong dalam bentuk unit). accountId wajib menunjuk akun
// bertipe 'investment'. BEDA dari write_off_debt: tool ini TIDAK
// menerima nominal sama sekali -- Worker menghitung sendiri
// averageCost x unit (lihat apps/worker/src/modules/investments/service.ts
// writeOffInvestment) dan membuat transaksi expense sebesar itu LANGSUNG
// pada akun investment itu sendiri. Untuk penjualan ke kas (ada uang
// yang diterima), ini BUKAN tool yang tepat -- pakai jalur jual investasi
// desktop (belum ada tool MCP utk itu, lihat get_investment_detail utk
// saleId+settle_investment_sale pada baris yang SUDAH ada).
export function registerWriteOffInvestment(server: McpServer) {
  server.registerTool(
    "write_off_investment",
    {
      title: "Write-off Unit Investasi",
      description:
        "Catat unit investasi yang hilang/dilepas TANPA kas yang berpindah -- hibah ke orang lain, delisting/perusahaan bangkrut, atau biaya admin yang dipotong dalam bentuk unit. accountId wajib menunjuk akun bertipe 'investment'. Worker otomatis menghitung average cost saat ini dan membuat transaksi expense sebesar averageCost x unit pada akun investment itu sendiri (balance berkurang sebesar cost basis yang dilepas, Realized P/L selalu negatif penuh). Ditolak 422 kalau unit melebihi sisa unit yang dimiliki. Untuk penjualan dengan uang yang diterima, ini BUKAN tool yang tepat.",
      inputSchema: z.object({
        accountId: z.string().min(1, "Akun wajib diisi").describe("Akun bertipe 'investment'"),
        unit: z.number().positive().describe("Jumlah unit yang hilang/dilepas"),
        date: dateField,
        note: z.string().optional(),
      }),
    },
    async (args, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, "/investments/write-off", {
        method: "POST",
        body: JSON.stringify({ id: newId(), ...args }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
