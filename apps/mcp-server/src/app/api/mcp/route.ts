import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { uuidv7 } from "uuidv7";
import { z } from "zod";
import { verifyWorkerToken, workerFetch } from "@/lib/worker-client";
import {
  fetchFullSnapshot,
  computeAccountBalance,
  listAliveAccounts,
  summarizeExpenseByCategory,
  listTransactions,
  summarizeDebts,
  listContactHistory,
} from "@/lib/sync-snapshot";

function getToken(ctx: { http?: { authInfo?: AuthInfo } }): string {
  const token = ctx.http?.authInfo?.token;
  if (!token) throw new Error("Missing auth token di konteks tool");
  return token;
}

// Tool tulis selalu kirim id baru (uuidv7) -- pola sama dgn PC desktop &
// Worker, id tidak pernah di-generate server (lihat shared/lww.ts kontrak
// UPSERT). Dipakai semua tool create_*.
function newId(): string {
  return uuidv7();
}

const handler = createMcpHandler((server) => {
  server.registerTool(
    "get_account_balances",
    {
      title: "Saldo Akun",
      description: "Lihat saldo semua akun (atau satu akun tertentu kalau accountId diisi).",
      inputSchema: z.object({
        accountId: z.string().optional().describe("ID akun spesifik, kosongkan untuk semua akun"),
      }),
    },
    async ({ accountId }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));

      const accounts = accountId
        ? listAliveAccounts(snapshot).filter((a) => a.id === accountId)
        : listAliveAccounts(snapshot);

      const result = accounts.map((a) => ({
        id: a.id,
        name: a.name,
        accountType: a.accountType,
        balance: computeAccountBalance(snapshot, a.id),
      }));

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_expense_summary_by_category",
    {
      title: "Ringkasan Pengeluaran per Kategori",
      description: "Total pengeluaran dikelompokkan per kategori, opsional filter rentang tanggal.",
      inputSchema: z.object({
        from: z.string().optional().describe("Tanggal mulai, format YYYY-MM-DD"),
        to: z.string().optional().describe("Tanggal akhir, format YYYY-MM-DD"),
      }),
    },
    async ({ from, to }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));
      const result = summarizeExpenseByCategory(snapshot, { from, to });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "list_transactions",
    {
      title: "Daftar Transaksi",
      description: "List transaksi terbaru, bisa difilter tanggal/tipe/akun.",
      inputSchema: z.object({
        limit: z.number().int().positive().max(100).optional().describe("Default 20, maksimal 100"),
        from: z.string().optional().describe("Tanggal mulai, format YYYY-MM-DD"),
        to: z.string().optional().describe("Tanggal akhir, format YYYY-MM-DD"),
        type: z.enum(["income", "expense", "transfer"]).optional(),
        accountId: z.string().optional(),
      }),
    },
    async ({ limit, from, to, type, accountId }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));
      const result = listTransactions(snapshot, { limit, from, to, type, accountId });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_debt_summary",
    {
      title: "Ringkasan Utang Piutang",
      description: "Total piutang (receivable) dan utang (payable) yang masih berjalan.",
      inputSchema: z.object({}),
    },
    async (_args, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));
      const result = summarizeDebts(snapshot);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_contact_history",
    {
      title: "Riwayat per Kontak",
      description: "Lihat riwayat transaksi dan utang/piutang untuk satu kontak tertentu.",
      inputSchema: z.object({
        contactId: z.string().describe("ID kontak"),
      }),
    },
    async ({ contactId }, ctx) => {
      const token = getToken(ctx);
      const snapshot = await fetchFullSnapshot((path) => workerFetch(token, path));
      const result = listContactHistory(snapshot, contactId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // --- Tool TULIS ---------------------------------------------------
  // Semua tool tulis manggil langsung endpoint Worker (POST/PATCH/
  // DELETE) lewat workerFetch, BUKAN proses snapshot lokal spt tool
  // BACA -- validasi bisnis (LWW, aturan debt, dst) harus tetap satu
  // pintu di Worker. id baru di-generate di sini (uuidv7) utk create,
  // sesuai pola PC desktop/Worker (id dari caller, bukan server-gen).

  const transactionFields = {
    type: z.enum(["income", "expense", "transfer"]),
    amount: z.number().positive(),
    note: z.string(),
    date: z.string().describe("Format YYYY-MM-DD"),
    categoryId: z.string().optional(),
    accountId: z.string().optional().describe("Akun sumber/utama"),
    transferAccountId: z.string().optional().describe("Akun tujuan, hanya utk type=transfer"),
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

  server.registerTool(
    "update_transaction",
    {
      title: "Ubah Transaksi",
      description: "Ubah transaksi yang sudah ada berdasarkan ID.",
      inputSchema: z.object({ transactionId: z.string(), ...transactionFields }),
    },
    async ({ transactionId, ...rest }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/transactions/${transactionId}`, {
        method: "PATCH",
        body: JSON.stringify(rest),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "delete_transaction",
    {
      title: "Hapus Transaksi",
      description:
        "Hapus transaksi berdasarkan ID. Wajib confirm:true -- aksi ini tidak bisa dibatalkan dari sisi Claude, pastikan sudah konfirmasi ke pengguna sebelum memanggil.",
      inputSchema: z.object({
        transactionId: z.string(),
        confirm: z.literal(true).describe("Harus true, konfirmasi eksplisit sebelum menghapus"),
      }),
    },
    async ({ transactionId }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/transactions/${transactionId}`, { method: "DELETE" });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "create_contact",
    {
      title: "Tambah Kontak",
      description: "Tambah kontak baru (nama orang/pihak untuk pencatatan utang-piutang atau transaksi).",
      inputSchema: z.object({
        name: z.string(),
        note: z.string().optional(),
      }),
    },
    async (args, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, "/contacts", {
        method: "POST",
        body: JSON.stringify({ id: newId(), ...args }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "update_contact",
    {
      title: "Ubah Kontak",
      description: "Ubah nama/catatan kontak yang sudah ada berdasarkan ID.",
      inputSchema: z.object({
        contactId: z.string(),
        name: z.string(),
        note: z.string().optional(),
      }),
    },
    async ({ contactId, ...rest }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/contacts/${contactId}`, {
        method: "PATCH",
        body: JSON.stringify(rest),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "delete_contact",
    {
      title: "Hapus Kontak",
      description:
        "Hapus kontak berdasarkan ID. Wajib confirm:true -- transaksi yang masih merujuk kontak ini akan kehilangan kaitannya (contact_id jadi kosong), bukan ikut terhapus.",
      inputSchema: z.object({
        contactId: z.string(),
        confirm: z.literal(true).describe("Harus true, konfirmasi eksplisit sebelum menghapus"),
      }),
    },
    async ({ contactId }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/contacts/${contactId}`, { method: "DELETE" });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  const accountFields = {
    name: z.string(),
    initialBalance: z.number(),
    accountType: z.enum(["cash", "debt"]),
    groupId: z.string().optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
  };

  server.registerTool(
    "create_account",
    {
      title: "Tambah Akun",
      description: "Tambah akun baru (kas/bank, atau akun bertipe debt untuk tracking utang-piutang).",
      inputSchema: z.object(accountFields),
    },
    async (args, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, "/accounts", {
        method: "POST",
        body: JSON.stringify({ id: newId(), ...args }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "update_account",
    {
      title: "Ubah Akun",
      description: "Ubah data akun yang sudah ada berdasarkan ID.",
      inputSchema: z.object({ accountId: z.string(), ...accountFields }),
    },
    async ({ accountId, ...rest }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/accounts/${accountId}`, {
        method: "PATCH",
        body: JSON.stringify(rest),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "delete_account",
    {
      title: "Hapus Akun",
      description:
        "Hapus akun berdasarkan ID. Wajib confirm:true. Kalau akun masih punya transaksi terkait, isi transactionAction ('unassign' atau 'reassign' dengan targetAccountId) -- kalau tidak diisi dan masih ada transaksi terkait, transaksi tetap merujuk akun yang sudah terhapus.",
      inputSchema: z.object({
        accountId: z.string(),
        confirm: z.literal(true).describe("Harus true, konfirmasi eksplisit sebelum menghapus"),
        transactionAction: z.enum(["unassign", "reassign"]).optional(),
        targetAccountId: z.string().optional().describe("Wajib diisi kalau transactionAction=reassign"),
      }),
    },
    async ({ accountId, confirm: _confirm, ...rest }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/accounts/${accountId}`, {
        method: "DELETE",
        body: JSON.stringify(rest),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "correct_account_balance",
    {
      title: "Koreksi Saldo Akun",
      description:
        "Sesuaikan saldo akun ke nominal target tertentu. Worker otomatis membuat transaksi penyesuaian (income/expense) dengan kategori 'Penyesuaian Saldo' untuk menutup selisihnya.",
      inputSchema: z.object({
        accountId: z.string(),
        targetBalance: z.number().describe("Saldo akhir yang diinginkan setelah koreksi"),
      }),
    },
    async (args, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, "/accounts/correct-balance", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  const categoryFields = {
    name: z.string(),
    type: z.enum(["income", "expense"]),
    icon: z.string().optional(),
    parentId: z.string().optional(),
    isActive: z.boolean().optional(),
  };

  server.registerTool(
    "create_category",
    {
      title: "Tambah Kategori",
      description: "Tambah kategori baru untuk income atau expense.",
      inputSchema: z.object(categoryFields),
    },
    async (args, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, "/categories", {
        method: "POST",
        body: JSON.stringify({ id: newId(), ...args }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "update_category",
    {
      title: "Ubah Kategori",
      description: "Ubah data kategori yang sudah ada berdasarkan ID.",
      inputSchema: z.object({ categoryId: z.string(), ...categoryFields }),
    },
    async ({ categoryId, ...rest }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/categories/${categoryId}`, {
        method: "PATCH",
        body: JSON.stringify(rest),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "delete_category",
    {
      title: "Hapus Kategori",
      description:
        "Hapus kategori berdasarkan ID. Wajib confirm:true. Kalau kategori masih punya sub-kategori atau transaksi terkait, isi childAction/targetParentId dan transactionAction/targetCategoryId sesuai kebutuhan -- kalau tidak diisi, relasi tetap merujuk kategori yang sudah terhapus.",
      inputSchema: z.object({
        categoryId: z.string(),
        confirm: z.literal(true).describe("Harus true, konfirmasi eksplisit sebelum menghapus"),
        childAction: z.enum(["unassign", "reassign"]).optional(),
        targetParentId: z.string().optional().describe("Wajib diisi kalau childAction=reassign"),
        transactionAction: z.enum(["unassign", "reassign"]).optional(),
        targetCategoryId: z.string().optional().describe("Wajib diisi kalau transactionAction=reassign"),
      }),
    },
    async ({ categoryId, confirm: _confirm, ...rest }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/categories/${categoryId}`, {
        method: "DELETE",
        body: JSON.stringify(rest),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "create_account_group",
    {
      title: "Tambah Grup Akun",
      description: "Tambah grup akun baru untuk mengelompokkan beberapa akun.",
      inputSchema: z.object({ name: z.string() }),
    },
    async (args, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, "/account-groups", {
        method: "POST",
        body: JSON.stringify({ id: newId(), ...args }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "update_account_group",
    {
      title: "Ubah Grup Akun",
      description: "Ubah nama grup akun yang sudah ada berdasarkan ID.",
      inputSchema: z.object({ accountGroupId: z.string(), name: z.string() }),
    },
    async ({ accountGroupId, ...rest }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/account-groups/${accountGroupId}`, {
        method: "PATCH",
        body: JSON.stringify(rest),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "delete_account_group",
    {
      title: "Hapus Grup Akun",
      description:
        "Hapus grup akun berdasarkan ID. Wajib confirm:true. Kalau grup masih punya anggota akun, isi memberAction ('unassign' atau 'reassign' dengan targetGroupId) -- kalau tidak diisi, akun anggota tetap merujuk grup yang sudah terhapus.",
      inputSchema: z.object({
        accountGroupId: z.string(),
        confirm: z.literal(true).describe("Harus true, konfirmasi eksplisit sebelum menghapus"),
        memberAction: z.enum(["unassign", "reassign"]).optional(),
        targetGroupId: z.string().optional().describe("Wajib diisi kalau memberAction=reassign"),
      }),
    },
    async ({ accountGroupId, confirm: _confirm, ...rest }, ctx) => {
      const token = getToken(ctx);
      const result = await workerFetch(token, `/account-groups/${accountGroupId}`, {
        method: "DELETE",
        body: JSON.stringify(rest),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
});

const verifyToken = async (_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;

  const isValid = await verifyWorkerToken(bearerToken);
  if (!isValid) return undefined;

  return {
    token: bearerToken,
    scopes: ["read:finance"],
    clientId: "financial-app-mcp",
  };
};

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ["read:finance"],
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authHandler as GET, authHandler as POST };
