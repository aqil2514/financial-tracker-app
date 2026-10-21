import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { fetchFullSnapshot, listThirdPartyDetail, buildNameLookups } from "@/lib/sync-snapshot/entities";

// Pola PERSIS get_debt_detail -- riwayat baris titip/ambil/pindah,
// termasuk transactionId tiap baris (kecuali kalau transaksi induknya
// sudah dihapus -- transaction_id SET NULL, lihat skema). Pakai
// transactionId dari sini utk update_transaction/delete_transaction
// kalau mau ubah/hapus satu baris titip/ambil LANGSUNG tertentu --
// TAPI baris hasil transfer (2 baris per transaksi, 1 transactionId sama)
// HANYA bisa dihapus lewat delete_transaction (edit-nya BELUM ada tool
// MCP terpisah, lihat docs/todos/plan/third-party-sync.md Tahap 4).
export function registerGetThirdPartyDetail(server: McpServer) {
  server.registerTool(
    "get_third_party_detail",
    {
      title: "Riwayat Titip/Ambil/Pindah Dana Pihak Ketiga",
      description:
        "Lihat riwayat lengkap titip/ambil/pindah dana pihak ketiga, termasuk transactionId tiap baris. Opsional filter per akun dan/atau kontak (AND kalau keduanya diisi, kosongkan keduanya untuk SEMUA riwayat).",
      inputSchema: z.object({
        accountId: z.string().optional().describe("Filter berdasarkan akun dana pihak ketiga tertentu"),
        contactId: z.string().optional().describe("Filter berdasarkan kontak tertentu"),
      }),
    },
    async ({ accountId, contactId }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));
      const rows = listThirdPartyDetail(snapshot, { accountId, contactId });
      const lookup = buildNameLookups(snapshot);

      const result = rows.map((r) => ({
        ...r,
        accountName: lookup.accountName.get(r.accountId) ?? r.accountId,
        contactName: lookup.contactName.get(r.contactId) ?? r.contactId,
      }));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
