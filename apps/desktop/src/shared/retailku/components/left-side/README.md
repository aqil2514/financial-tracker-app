# `left-side`

Sisi kiri dialog picker: pilih tool, filter tanggal, daftar data hasil tool itu.

## `index.tsx`

`LeftSide` — orchestrator (bukan barrel): baca context (`useInnerRetailkuPicker`), susun `ToolPicker` + `PeriodPicker` + (daftar atau placeholder "Pilih tools dulu...").

## `tool-picker.tsx`

`ToolPicker` — combobox controlled (`value`/`onChange`, tidak baca context) untuk pilih tool MCP. Opsinya (`TOOL_OPTIONS`) di-derive dari `RETAILKU_TOOLS` (`../../registry/`) — tambah tool baru di registry otomatis muncul di sini, tanpa sentuh file ini.

## `result-list.tsx`

`ResultList` — daftar hasil tool terpilih dalam `ScrollArea`, controlled (`selectedId`/`onSelect`), tapi SELAIN itu juga baca context sendiri untuk `client`/`status`/`selectedTool`/`dateRange` (perlu untuk fetch data, bukan cuma display). `useQuery` memanggil `RETAILKU_TOOLS[selectedTool].fetchList(client, {dateFrom, dateTo})` — `enabled` hanya saat koneksi MCP `status === "ready"` dan tool+rentang tanggal sudah dipilih.

`dateRange` dari context bentuknya `DateRange` (`react-day-picker`, `{from?: Date, to?: Date}`) — dikonversi ke string `"yyyy-MM-dd"` persis di titik panggil `fetchList`, bukan mengubah bentuk context (pola yang sama dipakai `features/account-detail/header/index.tsx`).

Query yang sama (key dan fetcher identik) juga dipanggil di `../right-side/index.tsx` untuk tahu detail item yang dipilih — React Query men-dedupe otomatis selama `queryKey` sama, jadi tidak fetch dua kali, tapi definisinya memang terduplikasi di dua file. Belum diekstrak ke hook bersama karena masih tahap awal.
