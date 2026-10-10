import { z } from "zod";

// Satu-satunya tempat validasi format tanggal dari tool MCP -- sebelum
// ini, field `date` cuma `z.string().describe("Format YYYY-MM-DD")`
// (describe cuma hint prompt utk Claude, BUKAN validasi Zod), jadi
// string APA PUN lolos ke Worker (yang juga cuma cek `typeof === "string"`,
// lihat transactions/schema.ts). Risikonya: `formatDate()` di desktop
// (apps/desktop/src/lib/format-date.ts) mendeteksi komponen waktu lewat
// cek literal "T" pada string -- tanggal dgn format lain (mis. "2026/10/05"
// atau "5 Oktober 2026") bisa membuat `new Date(value)` jadi Invalid Date
// saat baris itu di-pull ke desktop. Lihat mcp-server-business-logic-audit.md.
//
// Jam opsional (HH:mm) supaya format MCP sama persis dengan yang dihasilkan
// desktop (lihat use-create-transaction.ts: `toISOString().slice(0, 16)`
// dari local time) -- tanpa ini transaksi MCP selalu tampil tanpa jam di
// desktop meski row lain di hari yang sama punya jam.
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;

export const dateField = z
  .string()
  .regex(DATE_PATTERN, "Format tanggal harus YYYY-MM-DD atau YYYY-MM-DDTHH:mm, misal 2026-10-05T14:30")
  .describe(
    "Format YYYY-MM-DD, atau YYYY-MM-DDTHH:mm kalau jam transaksinya diketahui/relevan. " +
      "Jam HARUS WIB (UTC+7) -- field ini ditulis APA ADANYA (tanpa konversi timezone apa pun) " +
      "ke kolom `date` di D1, sama seperti desktop (toISOString() dari local time, lihat " +
      "use-create-transaction.ts). Jangan isi dari jam UTC/server mentah."
  );
