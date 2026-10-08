import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getToken, newId } from "@/lib/mcp-context";
import { workerFetchForm } from "@/lib/worker-client";

// Batas base64 ~7MB (~5MB file asli stlh di-encode) -- skala foto struk
// HP wajar (ratusan KB - beberapa MB), bukan validasi bisnis presisi,
// cuma jaga-jaga thd payload ekstrem yg tidak masuk akal utk tool call
// MCP single request. Worker TIDAK punya validasi ukuran sendiri saat
// ini (lihat attachment-r2-sync.md "Yang BELUM diputuskan" -- kuota
// belum diputuskan), batas ini murni sisi mcp-server.
const MAX_BASE64_LENGTH = 7_000_000;

// create_* lain (transactions/debts/dst) SEMUA kirim JSON ke workerFetch
// -- tool ini BEDA krn Worker POST /attachments butuh multipart/form-data
// (file binary), lihat worker-client.ts workerFetchForm.
export function registerUploadAttachment(server: McpServer) {
  server.registerTool(
    "upload_attachment",
    {
      title: "Upload Lampiran Foto Transaksi",
      description:
        "Upload foto (struk/nota/bukti) sebagai lampiran transaksi, mis. dari foto yang dikirim user lewat HP. Gambar harus base64 TANPA prefix 'data:image/...;base64,' (base64 mentah saja). Attachment ikut ter-sync ke semua device (desktop pull otomatis).",
      inputSchema: z.object({
        transactionId: z.string().min(1, "transactionId wajib diisi").describe("ID transaksi yang dilampiri"),
        imageBase64: z
          .string()
          .min(1)
          .max(MAX_BASE64_LENGTH, "Gambar terlalu besar (maks ~5MB)")
          .describe("Isi gambar sbg base64 mentah, TANPA prefix data URI"),
        mimeType: z
          .enum(["image/jpeg", "image/png", "image/webp", "image/heic"])
          .describe("Tipe gambar, dipakai Worker utk Content-Type & ekstensi file di R2"),
      }),
    },
    async ({ transactionId, imageBase64, mimeType }, ctx) => {
      const token = getToken(ctx);

      const bytes = Buffer.from(imageBase64, "base64");
      const form = new FormData();
      form.set("id", newId());
      form.set("transactionId", transactionId);
      form.set("file", new Blob([bytes], { type: mimeType }));

      const result = await workerFetchForm(token, "/attachments", form);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
