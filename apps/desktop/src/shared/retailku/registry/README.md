# `registry`

Jembatan antara `../helpers/tools/` (fungsi mentah pemanggil tool MCP) dan `../components/` (UI dialog picker). Satu sumber kebenaran per tool — `ToolPicker` (opsi combobox), `LeftSide` (ambil daftar data), dan `RightSide` (render detail) semua baca dari sini, bukan dari 3 tempat terpisah yang rawan lupa disinkronkan saat nambah tool baru.

## `types.ts`

`RetailkuToolEntry` — kontrak satu entri tool: `label` (teks combobox), `fetchList` (panggil tool asli lalu map ke `RetailkuPickerListItem[]`, lihat `../types/list-item.ts`), `fetchDetail` (panggil tool detail by id, dipanggil `RightSide` on-demand saat item diklik — BUKAN dari `fetchList`, supaya tidak N+1 request saat render list), `adapter` (`DetailAdapter`, lihat `../types/detail-adapter.ts`, menerima hasil `fetchDetail`, BUKAN item list).

## `get-cash-opname.ts`

Entry untuk tool `get_cash_opname_list`. `fetchList` memetakan tiap item list ke `{id, label: tanggal hitung, description: nominal selisih, raw: item list apa adanya}` — `raw` di sini TIDAK dipakai `adapter` (lihat `fetchDetail` di bawah), disimpan untuk tool lain yang mungkin tidak butuh fetch detail terpisah.

`fetchDetail` panggil `getCashOpnameDetail` by id. `adapter` menerima hasil itu (`RetailkuCashOpnameDetail` lengkap) — sudah termasuk breakdown dana pihak ketiga (`thirdPartyFunds`, satu baris field per dana), BELUM breakdown per denominasi (`items`, belum ada kebutuhan UI utk itu).

## `index.ts`

`RETAILKU_TOOLS: Record<namaTool, RetailkuToolEntry>` — daftar tool yang tersedia di dialog picker. Tambah tool baru = tambah satu file entry + satu baris di sini.
