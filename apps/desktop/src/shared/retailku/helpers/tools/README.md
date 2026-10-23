# `mcp-tools`

Pemanggilan tool MCP Retailku spesifik (`get_cashflow_detail`, `get_ar_ap`, `get_fund_transfer_list`, dst). Buka koneksinya sendiri (`connectRetailkuMcp`) ada di `../mcp-connection/`.

## `call-tool-as-json.ts`

Semua tool Retailku mengembalikan hasilnya sebagai satu block teks berisi JSON (bukan objek terstruktur MCP sendiri) — `callToolAsJson` adalah helper generik untuk parse `content[0].text`, dipakai semua fungsi `get*` di folder ini supaya tidak duplikasi logic parsing.

## `get_cash_opname_list.ts` / `get_cash_opname_detail.ts`

Type-nya ada di `../../types/tools/` (bukan dideklarasikan di sini) — lihat README di sana untuk daftar lengkapnya. Cash opname = hitung fisik kas vs saldo sistem. `get_cash_opname_detail` mengembalikan `thirdPartyFunds` (dana pihak ketiga yang ikut tercampur di laci kas, lihat `project_third_party_pull_bug_investigation` di memory) dan `items` (breakdown per denominasi). `netTotal` = `physicalTotal` dikurangi total `thirdPartyFunds` — itu yang dibandingkan ke `systemBalance` untuk hasilkan `difference`, BUKAN `physicalTotal` mentah. `difference` positif berarti kas lebih (selisih jadi income), negatif berarti kas kurang (selisih jadi expense) — ini yang relevan sebagai sumber transaksi adjustment nantinya.

Field angka datang sebagai string dari server (kecuali `thirdPartyFunds[].amount` dan `items[].value`/`quantity`, yang sudah number asli) — dikonversi ke `number` di kedua fungsi ini.

Diverifikasi ke data nyata toko "Warung Aqil" 2026-10-22, id `e4d78e39-4dd8-47fb-9149-ef36c61312a5` (2 dana pihak ketiga, 6 baris denominasi, status POSTED).

## `get_purchase_order_list.ts` / `get_purchase_order_detail.ts`

Type-nya ada di `../../types/tools/`. PO = pesanan ke supplier, bisa `DRAFT`/`SENT`/`CANCELLED`/`COMPLETED`. `get_purchase_order_detail` mengembalikan `purchasePayments[]` (tiap payment bisa `DOWN_PAYMENT` atau `SETTLEMENT`, punya `lines[]` — satu payment bisa split dibayar dari beberapa akun sekaligus) — ini sumber data untuk registry `toPackage`, BUKAN `totalAmount`/`outstandingAmount` di level PO.

`items[].itemType` (verifikasi ke source Retailku 2026-10-24) bisa `STOCK`/`SUPPLY`/`ASSET`/`RAW_MATERIAL`, BUKAN cuma `STOCK` — nama item bisa ada di `product` (STOCK), `material` (RAW_MATERIAL), atau cuma `itemName` bebas teks (SUPPLY/ASSET, tidak ada relasi product/material sama sekali). Lihat `../../registry/README.md` untuk detail lengkap per tipe.

Field angka datang sebagai string dari server, dikonversi ke `number`, KECUALI `items[].quantity` yang sudah number asli dari API (beda dari field angka lain di item yang sama).

Diverifikasi ke data nyata toko "Warung Aqil" 2026-10-23, id `b35af1a5-02a2-4d7c-b8f5-c0ee661843c0` (PO-261022-02, status SENT, 1 item, 1 payment SETTLEMENT lunas dari akun Seabank).

## `get_direct_purchase_list.ts` / `get_direct_purchase_detail.ts`

Type-nya ada di `../../types/tools/`. DPB (Direct Purchase/Pembelian Langsung) = beli langsung tanpa PO, `DRAFT`/`POSTED`/`CANCELLED`. `get_direct_purchase_detail` mengembalikan `paymentLines[]` flat (TANPA level payment di atasnya seperti PO — satu DPB satu set payment lines langsung) dan `adjustments[]` (mis. diskon/voucher yang mengurangi `totalAmount` dari `subtotalAmount`).

`items[].itemType` sama seperti PO — `STOCK`/`SUPPLY`/`ASSET`/`RAW_MATERIAL`, lihat catatan di `get_purchase_order_list.ts`/`get_purchase_order_detail.ts` di atas. Catatan khusus DPB: saat item `ASSET` diposting di Retailku, sistem OTOMATIS bikin record `FixedAsset` di sana — tool ini TIDAK mengekspos field `usefulLifeMonths` (umur manfaat aset) yang relevan untuk kasus itu.

Field angka datang sebagai string dari server, dikonversi ke `number`, KECUALI `items[].quantity` (sama seperti PO, sudah number asli).

Diverifikasi ke data nyata toko "Warung Aqil" 2026-10-23, id `7ceecd15-c76d-46fd-898a-16bf5b80b217` (DPB-261021-01, status POSTED, 1 item, adjustment voucher -Rp2.000, lunas dari Kas Tunai, ada journal entry POSTED).
