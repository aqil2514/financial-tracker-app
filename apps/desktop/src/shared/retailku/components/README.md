# `components`

UI dialog "Ambil dari Retailku" di halaman Transaksi (lihat `docs/todos/plan/retailku-transaction-picker.md`) — dua step dalam SATU dialog: step 1 (`left-side`/`right-side`) pilih tool Retailku + lihat daftar/detail; step 2 (`mapping-step`) petakan detail jadi satu atau lebih transaksi siap disimpan.

## `index.tsx`

`RetailkuPickerDialog` — orchestrator tunggal (bukan barrel) untuk dialog ini. Baca `useRetailkuDialog()` (dari `../context`, state buka/tutup dialog), bungkus `InnerRetailkuPickerProvider`, lalu `RetailkuPickerSteps` memilih render step 1 (`<LeftSide />`/`<RightSide />`, grid 2 kolom) atau step 2 (`<MappingStep />`, menggantikan SELURUH isi dialog) berdasarkan `step` di context.

Dialog pakai `<DialogContent>` mentah shadcn/base-ui tanpa `keepMounted` — artinya `InnerRetailkuPickerProvider` (dan koneksi MCP di dalamnya) benar-benar unmount/mount ulang tiap dialog ditutup/dibuka, bukan cuma disembunyikan via CSS.

## `context.tsx`

`InnerRetailkuPickerProvider`/`useInnerRetailkuPicker` — state lokal khusus di dalam dialog ini: `step` (`"browse" | "map"`, + `goToMapStep`/`goToBrowseStep`), `selectedTool`, `dateRange`, `selectedItemId`, `packageEntries`. Memilih tool baru otomatis reset `selectedItemId` (`setSelectedTool`).

`goToMapStep` (2026-10-24, BERUBAH SIGNATURE waktu `get-sale.ts`/mode "summary" ditambah) sekarang WAJIB terima `entries: RetailkuPackageEntry[]` — dulu tanpa argumen, `MappingStep` yang query `tool.toPackage(detailRaw)` sendiri pakai `selectedItemId` dari context. Alasan berubah: mode "summary" (`SummaryPanel`) TIDAK punya `selectedItemId` sama sekali (tidak ada langkah pilih-satu-item), tapi SUDAH punya `RetailkuPackageEntry[]` jadi dari `fetchSummary`. Supaya `MappingStep` tetap satu komponen generik utk kedua mode (bukan brach `if (summaryMode)` di dalamnya), context yang jadi titik temu: `goToMapStep` menyimpan entries APA ADANYA ke state `packageEntries`, dipanggil `ItemPanel` dengan `tool.toPackage(detailRaw)` ATAU `SummaryPanel` dengan hasil `fetchSummary` langsung — `MappingStep` sendiri tinggal baca `packageEntries` dari context, tidak tahu dan tidak perlu tahu asalnya dari mode mana.

Provider ini juga memanggil `useRetailkuMcpClient()` (lihat `../hooks/use-retailku-mcp-client.ts`) dan menyebar hasilnya (`status`/`client`/`error`) ke context yang sama — jadi koneksi MCP mengikuti lifecycle dialog: terbuka saat provider mount (dialog dibuka), tertutup otomatis saat provider unmount (dialog ditutup). Semua komponen di bawahnya (`LeftSide`/`RightSide`/`MappingStep`) tinggal baca `client`/`status` dari `useInnerRetailkuPicker()`, tidak perlu connect sendiri-sendiri.

## `left-side/`, `right-side/`, `mapping-step/`

`left-side`/`right-side` = step 1 (pilih tool/filter tanggal/daftar data di kiri, detail ATAU rangkuman di kanan — tergantung `tool.mode`, lihat README `right-side/`). `mapping-step` = step 2 (form per entri + submit, SELALU sama bentuknya apa pun mode tool asalnya — baca `packageEntries` dari context). Masing-masing punya beberapa file pendukung sendiri — lihat README di tiap folder.

Registry per tool (`RetailkuItemToolEntry`/`RetailkuSummaryToolEntry`, union lewat field `mode`) TIDAK ada di `components/` — ada di `../registry/`, karena dipakai lintas ketiga folder ini, bukan milik salah satu.
