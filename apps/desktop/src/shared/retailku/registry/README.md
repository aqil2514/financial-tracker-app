# `registry`

Jembatan antara `../helpers/tools/` (fungsi mentah pemanggil tool MCP) dan `../components/` (UI dialog picker). Satu sumber kebenaran per tool — `ToolPicker` (opsi combobox), `LeftSide` (ambil daftar data), dan `RightSide` (render detail) semua baca dari sini, bukan dari 3 tempat terpisah yang rawan lupa disinkronkan saat nambah tool baru.

## `types.ts`

`RetailkuToolEntry` — kontrak satu entri tool: `label` (teks combobox), `fetchList` (panggil tool asli lalu map ke `RetailkuPickerListItem[]`, lihat `../types/list-item.ts`), `fetchDetail` (panggil tool detail by id, dipanggil `RightSide` on-demand saat item diklik — BUKAN dari `fetchList`, supaya tidak N+1 request saat render list), `adapter` (`DetailAdapter`, lihat `../types/detail-adapter.ts`, menerima hasil `fetchDetail`, BUKAN item list).

## `get-cash-opname.ts`

Entry untuk tool `get_cash_opname_list`. `fetchList` memetakan tiap item list ke `{id, label: tanggal hitung, description: nominal selisih, raw: item list apa adanya}` — `raw` di sini TIDAK dipakai `adapter` (lihat `fetchDetail` di bawah), disimpan untuk tool lain yang mungkin tidak butuh fetch detail terpisah.

`fetchDetail` panggil `getCashOpnameDetail` by id. `adapter` menerima hasil itu (`RetailkuCashOpnameDetail` lengkap) — sudah termasuk breakdown dana pihak ketiga (`thirdPartyFunds`, satu baris field per dana), BELUM breakdown per denominasi (`items`, belum ada kebutuhan UI utk itu).

## `get-purchase-order.ts`

Entry untuk tool `get_purchase_order_list`/`get_purchase_order_detail`. Scope SENGAJA dibatasi ke pembayaran yang SUDAH tercatat di Retailku (`purchasePayments[].lines[]`, bisa banyak payment × banyak account line per PO) — `toPackage` generate SATU entry `target: "transaction"` (expense) per payment line, nominal dari `line.amount`, BUKAN dari `totalAmount` PO. Outstanding (PO belum lunas) TIDAK dibuatkan apa pun otomatis — `settle_debt_ids` di form transaksi cuma untuk melunasi debt yang SUDAH ada di desktop, bukan jalur bikin utang baru dari sini, jadi kasus PO belum lunas di luar scope awal, sama seperti Cash Opname (lihat `docs/todos/plan/retailku-transaction-picker.md`).

`account_id` tiap entry diisi dari `line.account.id` (ID akun Retailku, BUKAN ID akun lokal desktop) — sama seperti `get-cash-opname.ts`, field combobox akun di form TETAP harus dipilih manual oleh user sebelum submit karena tidak ada mapping otomatis Retailku→desktop.

`orderDate` dari Retailku UTC (suffix `Z`), dikonversi ke local time (`toLocalDateTimeInputValue`, duplikasi fungsi yang sama di `get-cash-opname.ts` — belum ada helper bersama, lihat alasan yang sama di sana) sebelum dipotong jadi value `<input type="datetime-local">`.

`note`/`description` tiap entry dihasilkan dari `raw.items` (SELURUH item PO, bukan cuma item yang terkait payment line itu — satu PO cuma satu daftar item, dipakai sama di semua entry payment turunannya), aturannya (2026-10-24): `note` ringkas (1-2 item → gabungan `"{nama item} {qty} {satuan}"` dipisah `" & "`; lebih dari 2 item → `"Pembelian"` saja) SELALU dipasangkan dengan `description` detail — TipTap `bulletList` (field `description` adalah rich text JSON, lihat `components/rich-text/parse-description.ts`, BUKAN plain text), SATU baris per item, format `"{nama} x {qty} {satuan} x {harga satuan} = {subtotal}"` (mis. "Permen Kopiko x 5 Pack x Rp8.600 = Rp43.000"), diikuti satu paragraf penutup `"Total Belanja: {totalAmount}"` setelah bullet list — `description` TIDAK pernah `null`, berlaku di SEMUA kasus (bukan cuma saat item lebih dari 2) supaya breakdown harga per item + total selalu terlihat walau `note` ringkas. `itemLabel()` pakai `item.product?.name ?? item.material?.name ?? item.itemName ?? "Item"` — `item.itemName` SERING `null` di data nyata (nama produk ada di `item.product.name`), jangan pakai `item.itemName` sendirian. `unitPrice` dipilih sebagai "harga" di tiap baris (bukan `subtotal`/`totalPrice`/`netTotal` milik item itu sendiri) karena itu harga PER SATUAN sebelum pengaruh diskon/alokasi biaya lain — subtotal per baris dihitung manual (`unitPrice * quantity`) supaya matematika di baris itu konsisten dengan yang ditulis (bukan `item.subtotal`/`totalPrice` API yang bisa sudah kena diskon/alokasi biaya berbeda). `totalAmount` (total final PO termasuk diskon/adjustment) dipakai utk "Total Belanja", BUKAN penjumlahan manual tiap baris.

`item.itemType` (verifikasi langsung ke source Retailku `retail-multitenant`, 2026-10-24, enum Prisma `PurchaseItemType`): BUKAN cuma `STOCK` — ada 4 nilai: `STOCK` (relasi `product`), `RAW_MATERIAL` (relasi `material`, bahan baku produksi, field terpisah dari `product`), `SUPPLY` (perlengkapan non-stok, cuma `itemName` bebas teks, tidak masuk stok produk, dibukukan ke akun expense), `ASSET` (aset tetap, juga `itemName` bebas teks + field `usefulLifeMonths` yang TIDAK diekspos tool MCP ini — saat DPB diposting di Retailku, item ASET otomatis bikin record `FixedAsset` di sana). Keempat tipe UI-nya aktif dipakai (dropdown "Tipe Barang" di form PO/DPB Retailku), bukan cuma teoretis. Entry di registry ini TIDAK membedakan perlakuan per `itemType` — pendekatan "expense per payment line" tetap valid utk semua tipe (uang yang keluar sama, tidak peduli jenis barangnya), yang dibedakan cuma sumber nama (`product`/`material`/`itemName`) lewat `itemLabel()`. Field `itemType` sendiri tidak ditampilkan di note/description — dipertimbangkan lagi kalau ternyata user butuh tahu kategori barangnya dari draft transaksi.

## `get-direct-purchase.ts`

Entry untuk tool `get_direct_purchase_list`/`get_direct_purchase_detail` (DPB/Pembelian Langsung) — pola PERSIS `get-purchase-order.ts`, termasuk logic `note`/`description` dari `raw.items` (note ringkas, description SELALU bullet list detail per item dengan harga satuan + subtotal, ditutup paragraf "Total Belanja" dari `totalAmount`). Bedanya struktur sumber: DPB punya `paymentLines[]` flat (langsung di level detail, TANPA level `purchasePayments` di atasnya seperti PO) jadi `toPackage` cuma satu `.map`, bukan `.flatMap`. Scope sama (hanya pembayaran yang sudah tercatat, outstanding di luar scope), `purchaseDate` juga UTC dan dikonversi local time dengan cara yang sama.

## `index.ts`

`RETAILKU_TOOLS: Record<namaTool, RetailkuToolEntry>` — daftar tool yang tersedia di dialog picker. Tambah tool baru = tambah satu file entry + satu baris di sini.
