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
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const dateField = z
  .string()
  .regex(DATE_ONLY_PATTERN, "Format tanggal harus YYYY-MM-DD, misal 2026-10-05")
  .describe("Format YYYY-MM-DD");
