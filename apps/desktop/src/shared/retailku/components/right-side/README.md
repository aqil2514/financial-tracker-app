# `right-side`

Sisi kanan dialog picker: detail/rangkuman data yang bisa dipakai, tergantung `tool.mode` (`../../registry/types.ts`).

## `index.tsx`

`RightSide` — dispatcher murni (2026-10-24, sebelumnya berisi logic `ItemPanel` langsung sebelum `get-sale.ts`/mode "summary" ada): baca `tool.mode`, render `SummaryPanel` kalau `"summary"`, `ItemPanel` kalau selain itu (termasuk `undefined`, default mode "item"). TIDAK ada `useQuery` di sini lagi — semua pindah ke panel masing-masing, supaya hook list/detail (mode item) tidak pernah jalan sia-sia saat tool-nya mode summary, dan sebaliknya.

## `item-panel.tsx`

`ItemPanel` — pola ASLI yang dulu ada di `index.tsx` (dipindah murni, logic tidak berubah), buat tool `mode: "item"` (Cash Opname/PO/DPB). Dua `useQuery` berjalan bersamaan:

1. Query list — SAMA dengan `../left-side/result-list.tsx` (key dan fetcher identik, lihat README di sana soal duplikasi ini). Dipakai HANYA untuk dapat `item.label` (judul di `DetailView`), bukan untuk detailnya.
2. Query detail — panggil `tool.fetchDetail(client, selectedItemId)` on-demand, cuma `enabled` begitu ada item terpilih. Hasilnya dilempar ke `tool.adapter(...)` untuk dapat `DetailAdapterResult`.

Tombol "Pakai Data Ini" memanggil `goToMapStep(tool.toPackage(detailRaw))` — BEDA dari versi sebelum mode "summary" ada (dulu `goToMapStep()` tanpa argumen, `MappingStep` yang query `toPackage` sendiri) — sekarang `goToMapStep` SELALU terima `RetailkuPackageEntry[]` jadi (lihat `../context.tsx`), `MappingStep` jadi konsumen pasif baik untuk hasil mode item maupun summary.

Fallback: "Pilih salah satu data..." (belum ada item terpilih), "Memuat detail..."/"Gagal memuat detail..." (query detail pending/error), atau "Detail belum tersedia..." (sukses tapi `adapter` tidak menghasilkan apa-apa — seharusnya jarang terjadi selama `fetchDetail` sukses).

## `summary-panel.tsx`

`SummaryPanel` — BARU (2026-10-24, lihat `../../registry/README.md` bagian `get-sale.ts` untuk alasan lengkap kenapa Sales butuh mode berbeda), buat tool `mode: "summary"`. TIDAK ada langkah pilih-item — `fetchSummary` dipanggil manual lewat tombol "Rangkum Rentang Ini" (`refetch()`, `useQuery` dengan `enabled: false` SENGAJA — jangan auto-fetch begitu rentang tanggal berubah, karena `fetchSummary` Sales bisa menarik PULUHAN `getSaleDetail` sekaligus, mahal kalau dipicu otomatis tiap user geser tanggal). Hasil preview ditampilkan sebagai daftar ringkas (label + tipe entry), tombol "Lanjut ke Pemetaan" memanggil `goToMapStep(entries)` langsung dari hasil query, BUKAN lewat `toPackage` — `fetchSummary` SUDAH mengembalikan `RetailkuPackageEntry[]` jadi (beda dari `ItemPanel` yang masih perlu `tool.toPackage(detailRaw)`).

## `detail-view.tsx`

`DetailView` — renderer generik murni (props `label`/`detail`, tidak baca context, tidak tahu bentuk tool apa pun), DIPAKAI HANYA oleh `item-panel.tsx`: label kecil, `amount` besar, `note` opsional, lalu daftar `fields` sebagai pasangan label-value. Bentuk datanya (`DetailAdapterResult`) didefinisikan di `../../types`.
