# `mcp-tools`

Pemanggilan tool MCP Retailku spesifik (`get_cashflow_detail`, `get_ar_ap`, `get_fund_transfer_list`, dst). Buka koneksinya sendiri (`connectRetailkuMcp`) ada di `../mcp-connection/`.

## `call-tool-as-json.ts`

Semua tool Retailku mengembalikan hasilnya sebagai satu block teks berisi JSON (bukan objek terstruktur MCP sendiri) — `callToolAsJson` adalah helper generik untuk parse `content[0].text`, dipakai semua fungsi `get*` di folder ini supaya tidak duplikasi logic parsing.

## `wib-date-range.ts`

`isWithinWibDayRange`/`wibDayRangeToUtcMs` — mitigasi bug Retailku yang mempengaruhi SEMUA tool `get_*_list` di folder ini (`get_cash_opname_list`, `get_purchase_order_list`, `get_direct_purchase_list`, `get_sale_list`): parameter `timezone`/`dateFrom`/`dateTo` Retailku TIDAK akurat di batas hari, membengkak sampai ~1 hari lewat batas yang diminta. Ditemukan 2026-10-24 via dogfooding `get_sale_list` (lihat `../../registry/README.md`, `get-sale.ts`), root cause ditelusuri sampai ke source code `retail-multitenant`: `apps/api/src/common/filters/apply-date-range-filter.ts` (`applyDateRangeFilter`) menerima timestamp yang SUDAH dikonversi timezone dengan benar oleh `buildDateFilter` (`apps/api/src/utils/date-filter.ts`), tapi menambahkan LAGI `+86400000ms - 1` ke `lte` dengan asumsi keliru bahwa inputnya tanggal mentah jam 00:00 — hasilnya batas akhir efektif maju ~1 hari dari yang diminta. Dikonfirmasi SEMUA 4 handler MCP (`get-sale-list.ts`, `get-cash-opname-list.ts`, `get-purchase-order-list.ts`, `get-direct-purchase-list.ts`) berbagi mekanisme `buildDateFilter` → `applyDateRangeFilter` yang sama persis — jadi satu akar bug untuk semua, dikonfirmasi EMPIRIS lewat panggilan MCP langsung untuk `get_sale_list` dan `get_cash_opname_list` (data `get_purchase_order_list`/`get_direct_purchase_list` di store "Warung Aqil" terlalu jarang untuk kebetulan menguji batas tengah malam WIB, tapi SECARA KODE 100% rentan bug yang sama).

Ini bug di Retailku (repo `retail-multitenant`, TERPISAH dari financial-app) — TIDAK bisa/tidak akan diperbaiki dari sisi sini. Mitigasi: tiap helper `get*List` di folder ini filter ULANG hasilnya secara manual pakai `isWithinWibDayRange`, berdasarkan field tanggal masing-masing (`countedAt`/`orderDate`/`purchaseDate`/`transactionDate`) dibandingkan ke batas hari WIB SUNGGUHAN dari `dateFrom`/`dateTo` yang diminta (WIB = UTC+7 tetap, tidak ada DST, geser offset konstan sudah cukup akurat, tidak perlu library timezone eksternal) — JANGAN percaya hasil filter tanggal Retailku apa adanya di mana pun dipakai. `meta.pagination.total`/`total` ikut disesuaikan ke `data.length` SETELAH difilter, supaya angka yang ditampilkan konsisten dengan data yang benar-benar dikembalikan (bukan angka mentah dari Retailku yang sudah ketahuan tidak akurat).

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

## `get_sale_list.ts` / `get_sale_detail.ts`

Type-nya ada di `../../types/tools/`. Penjualan Retailku, status `POSTED`/`CANCELLED`. `items[].product.type` (`RetailkuSaleProductType`) ada 6 nilai dari data nyata + enum Prisma: `MERCHANDISE`, `PPOB`, `MANUFACTURE`, `SERVICE`, `CONSIGNMENT`, `RAW_MATERIAL` — perlakuan finansial beda per tipe, lihat `../../registry/README.md` (`get-sale.ts`) untuk penjelasan lengkap kenapa dan buktinya (`get_journal_detail` Retailku).

`items[].unitCost`/`totalCost` punya ARTI BERBEDA tergantung tipe: untuk MERCHANDISE/MANUFACTURE/SERVICE itu HPP toko biasa (tidak dipakai registry ini, cukup `totalPrice`); untuk PPOB itu nilai saldo provider yang terkonsumsi; untuk CONSIGNMENT itu bagian yang harus disetor ke penitip (BUKAN HPP toko) — jangan asumsikan `totalCost` selalu berarti "modal/HPP" di semua konteks.

`paymentLines[]` kosong + `outstandingAmount > 0` berarti sale ini piutang penuh, belum ada uang masuk sama sekali saat `transactionDate` — pelunasan terjadi belakangan lewat `salePayments[]` (event terpisah, `paymentDate` beda).

Field angka datang sebagai string dari server, dikonversi ke `number`.

Diverifikasi ke data nyata toko "Warung Aqil" 2026-10-24 — beberapa transaksi dicek: `a20af114-8f30-4623-bda3-23c8f6585ce8` (PPOB piutang penuh, "Paket Data", `outstandingAmount: 45000`), `5bf68f51-ade7-4af2-9ffb-1bbcfb9ae7b7` (PPOB lunas belakangan lewat `salePayments`, "Pulsa Listrik"), `b9482a9f-fe67-4f7b-9422-d46e49f739b3` (PPOB lunas langsung saat transaksi, "Top Up E-Wallet"), `990ec30e-b41e-4bd2-bf3c-7e534cb61c38` & `164d0f3b-ddd4-481b-9713-feb184a24097` (CONSIGNMENT, journal dicek langsung via `get_journal_detail` — kredit "Hutang ke Penitip" + "Pendapatan Komisi Konsinyasi", BUKAN satu akun pendapatan penuh).
