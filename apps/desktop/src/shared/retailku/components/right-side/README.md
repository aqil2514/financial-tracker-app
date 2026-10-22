# `right-side`

Sisi kanan dialog picker: detail item yang dipilih di `left-side/`.

## `index.tsx`

`RightSide` — orchestrator, dua `useQuery` berjalan bersamaan:

1. Query list — SAMA dengan `../left-side/result-list.tsx` (key dan fetcher identik, lihat README di sana soal duplikasi ini). Dipakai HANYA untuk dapat `item.label` (judul di `DetailView`), bukan untuk detailnya.
2. Query detail — panggil `tool.fetchDetail(client, selectedItemId)` (`../../registry/`) on-demand, cuma `enabled` begitu ada item terpilih. Hasilnya dilempar ke `tool.adapter(...)` untuk dapat `DetailAdapterResult`.

Fallback: "Pilih salah satu data..." (belum ada item terpilih), "Memuat detail..."/"Gagal memuat detail..." (query detail pending/error), atau "Detail belum tersedia..." (sukses tapi `adapter` tidak menghasilkan apa-apa — seharusnya jarang terjadi selama `fetchDetail` sukses).

## `detail-view.tsx`

`DetailView` — renderer generik murni (props `label`/`detail`, tidak baca context, tidak tahu bentuk tool apa pun): label kecil, `amount` besar, `note` opsional, lalu daftar `fields` sebagai pasangan label-value. Bentuk datanya (`DetailAdapterResult`) didefinisikan di `../../types`.
