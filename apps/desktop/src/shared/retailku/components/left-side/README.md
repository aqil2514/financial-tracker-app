# `left-side`

Sisi kiri dialog picker: pilih tool, filter tanggal, daftar data hasil tool itu.

## `index.tsx`

`LeftSide` — orchestrator (bukan barrel): baca context (`useInnerRetailkuPicker`), susun `ToolPicker` + `PeriodPicker` + konten bawah yang tergantung `tool.mode` (`../../registry/types.ts`): tool `mode: "item"` → `ResultList`; tool `mode: "summary"` (Sales) → placeholder teks, karena mode ini TIDAK punya langkah pilih-item sama sekali, daftar+aksi sepenuhnya di `../right-side/summary-panel.tsx`.

## `tool-picker.tsx`

`ToolPicker` — combobox controlled (`value`/`onChange`, tidak baca context) untuk pilih tool MCP. Opsinya (`TOOL_OPTIONS`) di-derive dari `RETAILKU_TOOLS` (`../../registry/`) — tambah tool baru di registry otomatis muncul di sini, tanpa sentuh file ini, SAMA utk kedua mode (`item`/`summary`).

## `result-list.tsx`

`ResultList` — daftar hasil tool terpilih dalam `ScrollArea`, controlled (`selectedId`/`onSelect`), terima prop `tool: RetailkuItemToolEntry` (2026-10-24, BUKAN lagi ambil sendiri dari `RETAILKU_TOOLS[selectedTool]` di context — `LeftSide` yang narrow tipe-nya dulu, karena komponen ini SEKARANG cuma valid dipanggil untuk tool mode "item", lihat `types.ts`). `useQuery` memanggil `tool.fetchList(client, {dateFrom, dateTo})` — `enabled` hanya saat koneksi MCP `status === "ready"` dan rentang tanggal sudah dipilih.

`dateRange` dari context bentuknya `DateRange` (`react-day-picker`, `{from?: Date, to?: Date}`) — dikonversi ke string `"yyyy-MM-dd"` persis di titik panggil `fetchList`, bukan mengubah bentuk context (pola yang sama dipakai `features/account-detail/header/index.tsx`).

Query yang sama (key dan fetcher identik) juga dipanggil di `../right-side/item-panel.tsx` untuk tahu detail item yang dipilih — React Query men-dedupe otomatis selama `queryKey` sama, jadi tidak fetch dua kali, tapi definisinya memang terduplikasi di dua file. Belum diekstrak ke hook bersama karena masih tahap awal.
