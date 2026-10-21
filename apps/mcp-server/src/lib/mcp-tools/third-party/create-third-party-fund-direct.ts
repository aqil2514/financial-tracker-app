import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken, newId } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { dateField } from "@/lib/date-field";

// Pola PERSIS create_debt_direct / create_investment_purchase_direct --
// titip masuk/ambil keluar LANGSUNG, SATU SISI (bukan transfer, lihat
// docs/concept/konsep-dana-pihak-ketiga.md "Titip masuk / Ambil keluar").
// accountId wajib menunjuk akun bertipe 'third_party'. Kontak WAJIB
// diisi (contactId ATAU contactName, beda dari debts yang kontaknya
// nullable) -- third_party_funds.contact_id NOT NULL.
//
// Transfer third_party->third_party (pindah tempat/kepemilikan) BELUM
// ada tool MCP terpisah -- Worker belum bisa menderivasi transfer ini
// sendiri dari create_transaction generik (butuh 2 kontak independen,
// payload transaksi cuma py 1 contactId, lihat kendala yang ditemukan
// di Tahap 2 docs/todos/plan/third-party-sync.md). Kalau perlu
// memindahkan titipan lewat MCP, TIDAK ADA jalur saat ini -- harus lewat
// desktop.
export function registerCreateThirdPartyFundDirect(server: McpServer) {
  server.registerTool(
    "create_third_party_fund_direct",
    {
      title: "Catat Titip/Ambil Dana Pihak Ketiga",
      description:
        "Catat uang yang dititipkan masuk ATAU diambil keluar dari akun dana pihak ketiga -- SATU SISI (bukan transfer antar akun). direction='in' = ada yang nitip, direction='out' = ada yang ambil (DITOLAK otomatis kalau nominal melebihi sisa titipan kontak itu di akun ini). accountId wajib menunjuk akun bertipe 'third_party'. Kontak WAJIB diisi (contactId atau contactName). Untuk memindahkan titipan antar akun atau antar kontak (pindah tempat/kepemilikan), BELUM ada tool ini -- harus lewat aplikasi desktop.",
      inputSchema: z.object({
        direction: z.enum(["in", "out"]).describe("in = ada yang nitip (titip masuk), out = ada yang ambil (ambil keluar)"),
        amount: z.number().positive(),
        accountId: z.string().min(1, "Akun wajib diisi").describe("Akun bertipe 'third_party'"),
        date: dateField,
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
      const result = await workerFetch(token, "/third-party-funds/direct", {
        method: "POST",
        body: JSON.stringify({ id: newId(), ...args }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
