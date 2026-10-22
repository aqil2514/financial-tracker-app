# `components`

UI dialog "Ambil dari Retailku" di halaman Transaksi (lihat `docs/todos/plan/retailku-transaction-picker.md`) — dua step dalam SATU dialog: step 1 (`left-side`/`right-side`) pilih tool Retailku + lihat daftar/detail; step 2 (`mapping-step`) petakan detail jadi satu atau lebih transaksi siap disimpan.

## `index.tsx`

`RetailkuPickerDialog` — orchestrator tunggal (bukan barrel) untuk dialog ini. Baca `useRetailkuDialog()` (dari `../context`, state buka/tutup dialog), bungkus `InnerRetailkuPickerProvider`, lalu `RetailkuPickerSteps` memilih render step 1 (`<LeftSide />`/`<RightSide />`, grid 2 kolom) atau step 2 (`<MappingStep />`, menggantikan SELURUH isi dialog) berdasarkan `step` di context.

Dialog pakai `<DialogContent>` mentah shadcn/base-ui tanpa `keepMounted` — artinya `InnerRetailkuPickerProvider` (dan koneksi MCP di dalamnya) benar-benar unmount/mount ulang tiap dialog ditutup/dibuka, bukan cuma disembunyikan via CSS.

## `context.tsx`

`InnerRetailkuPickerProvider`/`useInnerRetailkuPicker` — state lokal khusus di dalam dialog ini: `step` (`"browse" | "map"`, + `goToMapStep`/`goToBrowseStep`), `selectedTool`, `dateRange`, `selectedItemId`. Memilih tool baru otomatis reset `selectedItemId` (`setSelectedTool`).

Provider ini juga memanggil `useRetailkuMcpClient()` (lihat `../hooks/use-retailku-mcp-client.ts`) dan menyebar hasilnya (`status`/`client`/`error`) ke context yang sama — jadi koneksi MCP mengikuti lifecycle dialog: terbuka saat provider mount (dialog dibuka), tertutup otomatis saat provider unmount (dialog ditutup). Semua komponen di bawahnya (`LeftSide`/`RightSide`/`MappingStep`) tinggal baca `client`/`status` dari `useInnerRetailkuPicker()`, tidak perlu connect sendiri-sendiri.

## `left-side/`, `right-side/`, `mapping-step/`

`left-side`/`right-side` = step 1 (pilih tool/filter tanggal/daftar data di kiri, detail item di kanan). `mapping-step` = step 2 (form per entri + submit). Masing-masing punya beberapa file pendukung sendiri — lihat README di tiap folder.

Registry per tool (`label`, `fetchList`, `fetchDetail`, `adapter`, `toPackage`) TIDAK ada di `components/` — ada di `../registry/`, karena dipakai lintas ketiga folder ini, bukan milik salah satu.
