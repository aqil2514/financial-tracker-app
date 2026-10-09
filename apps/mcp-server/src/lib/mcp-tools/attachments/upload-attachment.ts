import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { createHash } from "crypto";
import { getToken, newId } from "@/lib/mcp-context";
import { workerFetchForm } from "@/lib/worker-client";

// Batas base64 ~7MB (~5MB file asli stlh di-encode) -- skala foto struk
// HP wajar (ratusan KB - beberapa MB), bukan validasi bisnis presisi,
// cuma jaga-jaga thd payload ekstrem yg tidak masuk akal utk tool call
// MCP single request. Worker TIDAK punya validasi ukuran sendiri saat
// ini (lihat attachment-r2-sync.md "Yang BELUM diputuskan" -- kuota
// belum diputuskan), batas ini murni sisi mcp-server.
const MAX_BASE64_LENGTH = 7_000_000;

// Magic bytes per format -- dicek thdp PREFIX **dan** SUFFIX bytes hasil
// decode base64 (bukan isi tengah -- itu butuh decode gambar penuh,
// tidak ada library image di proyek ini & tidak worth nambah dependency
// berat cuma utk ini). Tujuannya deteksi corruption kasar (mis. base64
// yg disalin ulang model LLM kehilangan/salah karakter) SEBELUM dikirim
// ke Worker -- lihat docs/dogfooding/2026-10-09-upload-attachment-corrupt-dan-orphan.md
// case nyata di mana upload "sukses" tapi file rusak krn tidak ada
// pengecekan apa pun di titik ini sebelumnya (byte yg beda saat itu ada
// di TENGAH file, jadi cek ini TIDAK akan menangkap kasus itu persis --
// tapi tetap menangkap kelas error yg jauh lebih umum: truncation/prefix
// hilang krn base64 terpotong). JPEG dicek SOI (0xFFD8) di awal DAN EOI
// (0xFFD9) di akhir -- EOI yg hilang berarti file terpotong/truncated.
// webp dicek via marker "WEBP" di offset 8 (RIFF....WEBP), heic tidak
// dicek krn struktur box-nya tidak punya magic bytes sesederhana itu.
const MAGIC_BYTES: Record<string, (bytes: Buffer) => boolean> = {
  "image/jpeg": (b) =>
    b.length >= 4 &&
    b[0] === 0xff &&
    b[1] === 0xd8 &&
    b[b.length - 2] === 0xff &&
    b[b.length - 1] === 0xd9,
  "image/png": (b) =>
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a,
  "image/webp": (b) => b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
  "application/pdf": (b) => b.length >= 4 && b.toString("ascii", 0, 4) === "%PDF",
};

// create_* lain (transactions/debts/dst) SEMUA kirim JSON ke workerFetch
// -- tool ini BEDA krn Worker POST /attachments butuh multipart/form-data
// (file binary), lihat worker-client.ts workerFetchForm.
export function registerUploadAttachment(server: McpServer) {
  server.registerTool(
    "upload_attachment",
    {
      title: "Upload Lampiran Transaksi",
      description:
        "Upload foto atau PDF (struk/nota/invoice) sebagai lampiran transaksi, mis. dari foto yang dikirim user lewat HP atau PDF invoice. File harus base64 TANPA prefix 'data:...;base64,' (base64 mentah saja). Attachment ikut ter-sync ke semua device (desktop pull otomatis).",
      inputSchema: z.object({
        transactionId: z.string().min(1, "transactionId wajib diisi").describe("ID transaksi yang dilampiri"),
        imageBase64: z
          .string()
          .min(1)
          .max(MAX_BASE64_LENGTH, "File terlalu besar (maks ~5MB)")
          .describe("Isi file sbg base64 mentah, TANPA prefix data URI"),
        mimeType: z
          .enum(["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"])
          .describe("Tipe file, dipakai Worker utk Content-Type & ekstensi file di R2"),
      }),
    },
    async ({ transactionId, imageBase64, mimeType }, ctx) => {
      const token = getToken(ctx);

      const bytes = Buffer.from(imageBase64, "base64");
      const checkMagicBytes = MAGIC_BYTES[mimeType];
      if (checkMagicBytes && !checkMagicBytes(bytes)) {
        throw new Error(
          `Isi gambar tidak valid utk mimeType ${mimeType} (magic bytes tidak cocok) -- base64 kemungkinan korup/terpotong saat disalin. Jangan retry dgn data yg sama, minta ulang gambarnya.`
        );
      }

      const form = new FormData();
      form.set("id", newId());
      form.set("transactionId", transactionId);
      form.set("file", new Blob([bytes], { type: mimeType }));

      const result = await workerFetchForm<{ status: string; id: string; checksumSha256?: string }>(
        token,
        "/attachments",
        form
      );

      // Bandingkan checksum yg Worker hitung dari bytes yg ia terima &
      // simpan ke R2, thdp checksum bytes yg KITA kirim -- kalau beda,
      // berarti ada corruption di jalur HTTP form-data (bukan lagi soal
      // base64 yg disalin model, itu sudah lolos magic-byte check di
      // atas). Attachment row-nya SUDAH tersimpan di titik ini (Worker
      // sudah commit), jadi caller perlu diberi tahu eksplisit utk hapus
      // via delete_attachment kalau checksum tidak cocok -- TIDAK
      // auto-delete di sini krn tool ini tidak boleh diam-diam melakukan
      // aksi destruktif tambahan.
      if (result.status === "ok" && result.checksumSha256) {
        const localChecksum = createHash("sha256").update(bytes).digest("hex");
        if (localChecksum !== result.checksumSha256) {
          throw new Error(
            `Checksum tidak cocok setelah upload (lokal: ${localChecksum}, Worker: ${result.checksumSha256}) -- attachment ${result.id} kemungkinan korup di jalur upload. Hapus dgn delete_attachment lalu coba upload ulang.`
          );
        }
      }

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
