# `mcp-tools`

Pemanggilan tool MCP Retailku spesifik (`get_cashflow_detail`, `get_ar_ap`, `get_fund_transfer_list`, dst). Buka koneksinya sendiri (`connectRetailkuMcp`) ada di `../mcp-connection/`.

## `call-tool-as-json.ts`

Semua tool Retailku mengembalikan hasilnya sebagai satu block teks berisi JSON (bukan objek terstruktur MCP sendiri) — `callToolAsJson` adalah helper generik untuk parse `content[0].text`, dipakai semua fungsi `get*` di folder ini supaya tidak duplikasi logic parsing.

## `get_cash_opname_list.ts` / `get_cash_opname_detail.ts`

Type-nya ada di `../../types/tools/` (bukan dideklarasikan di sini) — lihat README di sana untuk daftar lengkapnya. Cash opname = hitung fisik kas vs saldo sistem. `get_cash_opname_detail` mengembalikan `thirdPartyFunds` (dana pihak ketiga yang ikut tercampur di laci kas, lihat `project_third_party_pull_bug_investigation` di memory) dan `items` (breakdown per denominasi). `netTotal` = `physicalTotal` dikurangi total `thirdPartyFunds` — itu yang dibandingkan ke `systemBalance` untuk hasilkan `difference`, BUKAN `physicalTotal` mentah. `difference` positif berarti kas lebih (selisih jadi income), negatif berarti kas kurang (selisih jadi expense) — ini yang relevan sebagai sumber transaksi adjustment nantinya.

Field angka datang sebagai string dari server (kecuali `thirdPartyFunds[].amount` dan `items[].value`/`quantity`, yang sudah number asli) — dikonversi ke `number` di kedua fungsi ini.

Diverifikasi ke data nyata toko "Warung Aqil" 2026-10-22, id `e4d78e39-4dd8-47fb-9149-ef36c61312a5` (2 dana pihak ketiga, 6 baris denominasi, status POSTED).
