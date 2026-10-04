import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken } from "@/lib/mcp-context";
import { workerFetch } from "@/lib/worker-client";
import { fetchFullSnapshot, listDebtDetails } from "@/lib/sync-snapshot";

// Menutup gap cloud-sync.md Tahap 8: tanpa ini, Claude tidak punya cara
// menemukan transactionId satu baris cicilan (debt_payments) tertentu --
// padahal update_transaction/delete_transaction yang SUDAH ADA bisa
// langsung dipakai utk edit/hapus cicilan (Worker PATCH/DELETE
// /transactions/:id reuse applyDebtTransactionEdit/
// detachDebtForDeletedTransaction, sama seperti use-edit-payment.ts
// desktop) -- gap-nya murni di sisi BACA, bukan di Worker.
export function registerGetDebtDetail(server: McpServer) {
  server.registerTool(
    "get_debt_detail",
    {
      title: "Detail Piutang/Utang + Riwayat Cicilan",
      description:
        "Lihat detail piutang/utang beserta daftar cicilannya (debt_payments), termasuk transactionId tiap cicilan. Pakai transactionId dari sini untuk memanggil update_transaction/delete_transaction kalau mau ubah/hapus satu cicilan tertentu.",
      inputSchema: z.object({
        debtId: z.string().optional().describe("ID piutang/utang spesifik, kosongkan untuk semua yang masih berjalan"),
        contactId: z.string().optional().describe("Filter berdasarkan kontak"),
      }),
    },
    async ({ debtId, contactId }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));
      const result = listDebtDetails(snapshot, { debtId, contactId });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
