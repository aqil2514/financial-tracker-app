# Transaksi dari MCP tersimpan dengan `description` plain text, bukan TipTap JSON

Ditemukan saat mengecek transaksi terbaru di database dev/prod atas permintaan user ("baca transaksi terbaru, deskripsinya berbeda ya dengan yang lain"). Transaksi "Ketoprak" (dibuat lewat MCP, `sync_source: "mcp"`) punya kolom `description` berisi string plain `"Ketoprak"` — sama persis dengan `note` — padahal desktop app SELALU menyimpan `description` sebagai string JSON hasil `JSON.stringify()` dari dokumen TipTap (rich text editor). Baris ini akan membuat `JSON.parse(transaction.description)` di desktop melempar `SyntaxError` begitu dibuka, karena `"Ketoprak"` bukan JSON valid.

## Bagaimana ketahuan

1. User minta baca transaksi terbaru di `finance.dev.db`, lalu minta cek versi prod (D1) juga.
2. Ketemu baris `01a13519-2fc7-…` dengan `description` berupa TipTap JSON valid (`{"type":"doc","content":[...]}`) — sempat dikira bug karena "beda dari transaksi lain yang description-nya kosong", tapi setelah dicek skema (`transaction-form/schema/schema.ts`: `description: z.custom<JSONContent>()`), itu memang format yang benar.
3. User menunjukkan baris yang SEBENARNYA mencurigakan: `01a13796-f912-…` ("Ketoprak"). Dicek penuh — `note` dan `description` isinya sama persis, `sync_source: 'mcp'`. Ini bukan TipTap JSON.
4. Scan seluruh tabel `transactions` di D1 production (207 baris dengan `description` terisi) — cuma **1 baris** yang gagal `JSON.parse` atau hasil parse-nya bukan `{type: "doc", ...}`. Insiden terisolasi, bukan sistemik.

## Root cause

### 1. MCP tool `create_transaction`/`update_transaction` tidak memvalidasi bentuk `description`

Field `description` di `transactionFields` (`apps/mcp-server/.../create-transaction.ts`) sebelumnya cuma `z.string().optional()` — Zod menerima string APA PUN, tidak ada constraint bentuk JSON/TipTap. Tidak ada `.describe()` yang menjelaskan formatnya ke Claude sebagai pemanggil tool, jadi tidak ada sinyal bahwa `description` harus sama formatnya dengan rich text editor desktop.

### 2. Worker juga tidak memvalidasi bentuknya

`isPushTransactionPayload`/`isPatchTransactionPayload` (`apps/worker/src/modules/transactions/schema.ts`) memvalidasi hampir semua field (`type`, `amount`, `note`, akun, investment fields, dst) tapi `description` tidak disentuh sama sekali — `payload.description ?? null` langsung di-INSERT/UPDATE ke D1 apa adanya. Tidak ada lapisan pertahanan di titik mana pun antara MCP dan database.

### 3. Desktop app mengasumsikan `description` SELALU TipTap JSON, tanpa fallback

Tiga tempat (`transaction-detail-dialog.tsx`, `detail-tab.tsx`, `use-update-transaction/index.ts`) melakukan `JSON.parse(transaction.description)` langsung tanpa try/catch. Asumsi ini valid untuk semua baris yang lahir dari desktop (rich text editor selalu menghasilkan TipTap JSON), tapi gagal total untuk baris yang lahir dari jalur lain (MCP) yang tidak terikat kontrak itu.

## Dampak data

Satu baris, di D1 production dan ter-sync ke `finance.dev.db` lokal:

```
01a13796-f912-72f3-95bc-cc6a60c9a0ac | expense 10000 | note="Ketoprak" | description="Ketoprak" | sync_source=mcp
```

Scan 207 baris `description` terisi di D1 → hanya baris ini yang rusak. Baris lain (termasuk yang lain-lain dari MCP) semua TipTap JSON valid.

## Perbaikan

### Data

`description` baris itu diubah dari `"Ketoprak"` jadi TipTap doc valid yang membungkus teks yang sama, di D1 production dan di `finance.db` lokal (backup `finance.db.bak_20261014_140837_before-fix-mcp-description` dibuat sebelum ubah file lokal, sesuai [docs/rules/checking-dev-database.md](../../apps/desktop/docs/rules/checking-dev-database.md)):

```sql
UPDATE transactions
SET description = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ketoprak"}]}]}'
WHERE id = '01a13796-f912-72f3-95bc-cc6a60c9a0ac';
```

### Kode — tiga lapis

1. **Desktop, defensif terhadap data lama/korup** — helper baru `parseDescription()` (`apps/desktop/src/components/rich-text/parse-description.ts`) menangkap `JSON.parse` gagal dan fallback membungkus plain text jadi paragraf TipTap, dipakai di ketiga titik yang tadinya parse manual tanpa try/catch.
2. **Worker, pintu gerbang sesungguhnya** — `isValidTiptapDocString()` baru (`apps/worker/src/shared/tiptap-doc.ts`) mengecek bentuk minimal (`{type: "doc", content: [...]}`), dipasang di `isPushTransactionPayload` & `isPatchTransactionPayload` lewat `isValidDescriptionField()`. Payload dengan `description` yang bukan TipTap JSON ditolak dengan `400 Invalid Payload` sebelum sampai ke D1 — berlaku untuk semua pemanggil (desktop push maupun MCP), bukan cuma MCP.
3. **MCP, validasi + describe jelas di titik asal** — `descriptionField` baru (`apps/mcp-server/src/lib/description-field.ts`), dipakai di `transactionFields` sehingga otomatis berlaku untuk `create_transaction` DAN `update_transaction` (keduanya share field set yang sama). Zod `.refine()` menolak dengan pesan error + contoh format benar sebelum request dikirim ke Worker sama sekali. `note` juga diberi `.describe()` baru agar bedanya ("judul singkat plain text" vs "catatan panjang TipTap JSON") eksplisit ke Claude sebagai pemanggil tool.

## Catatan untuk ke depan

Kontrak "field X selalu berformat Y" yang hanya hidup sebagai konvensi antar-app (desktop menulis TipTap JSON, Worker meneruskan apa adanya, MCP seharusnya ikut tapi tidak dipaksa) akan terus bisa dilanggar oleh jalur mana pun yang tidak eksplisit memvalidasinya — persis seperti `dateField` (`apps/mcp-server/src/lib/date-field.ts`) yang sudah lebih dulu mengalami ini untuk kolom `date`. Pola yang benar: validasi di titik MASUK data (MCP tool via Zod) UNTUK sinyal cepat ke caller, DAN di pintu gerbang bersama (Worker) supaya semua jalur pemanggil (bukan cuma MCP) ikut terlindungi — satu saja tidak cukup, karena jalur pemanggil baru bisa muncul kapan saja tanpa lewat Zod tool MCP.
