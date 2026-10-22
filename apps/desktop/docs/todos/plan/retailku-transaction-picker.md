# Retailku Transaction Picker — Dialog Pilih Data Retailku untuk Prefill Transaksi

## Status & TODO saat ini (ringkas)

Rancangan konsep hasil diskusi 2026-10-22, menggantikan pendekatan sync otomatis lama (`features/retailku/shared/sync/cashflow/**`) yang dianggap tidak efisien — lihat bagian "Latar belakang" untuk alasan lengkapnya.

- [ ] Putuskan daftar tools MCP Retailku mana saja yang diekspos di dialog ini (ditunda, belum dibahas).
- [ ] Desain dialog "Ambil dari Retailku" — pemilih tool → list hasil → detail item.
- [ ] Desain kontrak adapter per-tool (`toolResult -> TransactionPrefill`).
- [ ] Implementasi prefill ke dialog "Tambah Transaksi" yang sudah ada (bukan field baru di form, bukan auto-insert).
- [ ] Tools pertama diimplementasikan sebagai proof of concept, dites jalan beberapa hari nyata sebelum ditambah tools lain.
- [ ] Setelah terbukti jalan: evaluasi apakah kode sync lama (`features/retailku/shared/sync/cashflow/**`, proses background, kolom `source`/`source_ref` di `transactions`) dihapus.
- [ ] (Ditunda, bukan scope awal) Konfigurasi default kategori/akun per-tool atau per-sourceType, disimpan sebagai config — baru dipertimbangkan setelah alur dasar terbukti jalan beberapa hari.

## Latar belakang

Dicatat juga di `apps/desktop/docs/todos/plan/cloud-sync-retailku-provenance-gap.md` (dokumen terpisah, soal gap provenance `source`/`source_ref` di jalur cloud-sync) — dokumen itu membahas bug di desain LAMA, dokumen ini membahas rombakan konsepnya.

Fitur sync Retailku -> Desktop yang ada sekarang (`features/retailku/shared/sync/cashflow/**`, status "done" di `docs/todos/done/retailku-cashflow-sync.md`) berjalan sebagai proses sinkronisasi otomatis: menarik data `get_cashflow_detail` dari Retailku (yang sebenarnya per-transaksi/per jurnal kas, lihat `source-ref` seperti `"SL-260901-01"`), lalu MENGAGREGASI jadi satu baris transaksi per hari (mode "summary", note generik `"Ringkasan Kas Harian Retailku — {accountName}"`) atau per hari+sourceType (mode "detail", note `"Kas Harian Retailku — {accountName} — {sourceType}"`).

Setelah dipakai beberapa minggu, user berhenti memakai sync otomatis ini (baris `source='retailku_sync'` terakhir di production D1 tanggal 2026-10-03, sejak itu nihil) dan beralih ke input manual, karena detail hasil sync dianggap kurang — note generik tidak menangkap detail per-item/transaksi yang didapat kalau diinput manual (lihat perbandingan nyata di production: baris manual seperti `"Permen Kopiko 5 Pack"`, `"Minyak Wangi Roll On 12pcs"` vs baris sync `"Omzet Dagang"`/ringkasan harian).

User menilai desain lama ini "tidak efisien" dan ingin dirombak total, bukan sekadar diperbaiki granularitasnya.

## Konsep baru

### Titik integrasi: dialog, bukan field form, bukan proses background

Bukan proses sync otomatis yang menulis langsung ke `transactions` di belakang layar. Bukan juga field tambahan di dalam form "Tambah Transaksi" yang sudah ada. Titik integrasinya adalah **dialog baru** di halaman Transaksi (tombol baru, berdampingan dengan tombol "+ Tambah Transaksi" yang sudah ada), yang **menjembatani** ke dialog "Tambah Transaksi" yang sudah ada lewat prefill — form itu sendiri tetap satu-satunya jalur tulis ke `transactions`.

### Alur dialog

1. User klik tombol "Ambil dari Retailku" di halaman Transaksi -> dialog terbuka.
2. User pilih salah satu tool MCP Retailku read-only yang relevan dengan transaksi (daftar tools belum diputuskan, lihat TODO).
3. Tool dijalankan -> dialog menampilkan list hasil (mis. list PO hari ini).
4. User klik salah satu item di list -> tampil detail item itu.
5. User klik tombol "Pakai" (atau sejenis) di detail -> dialog Retailku tertutup, dialog "Tambah Transaksi" terbuka, dengan field yang relevan sudah terisi (prefill) dari detail item tadi.
6. User tetap bisa mengedit field apa pun sebelum submit -- prefill cuma mempercepat pengisian, bukan auto-submit.

### Arsitektur UI: sebisa mungkin generik, mirip pola `FilterPanel`

Belum ada gambaran konkret (belum didesain), tapi arahnya: dialog ini sebisa mungkin dibangun **generik**, bukan satu dialog baru per-tool. Analoginya mirip sistem filter yang sudah ada di proyek ini (`components/query/filters/panel/**`, lihat README di folder itu) -- provider + shell popover/dialog yang generik dan sama persis untuk semua tool, sementara konten tiap step (pilih tool, list, detail) di-render berdasarkan registrasi config per-tool, bukan ditulis ulang per-tool dari nol. Komponen per-tool (list/detail) tetap **controlled** (terima data+callback lewat props, tidak baca context langsung) -- pola yang sama dgn `FilterText`/`FilterSelect` di sistem filter, supaya gampang diuji/dipakai terpisah. Detail bentuk registry/interface-nya BELUM diputuskan -- ini baru arah umum, didetailkan nanti pas mulai implementasi tool pertama.

### Mapping / prefill

Field yang diprefill secara umum: **nama/deskripsi** dan **nominal** saja. Field lain (akun, kategori, kontak, label) TIDAK diprefill -- tetap keputusan manual user tiap kali, karena itu klasifikasi subjektif yang tidak bisa ditebak dari data POS.

Karena tiap tool MCP Retailku punya bentuk data (shape) yang berbeda-beda, mapping dari hasil tool ke field form **tidak digeneralisasi otomatis** -- tiap tool butuh adapter sendiri yang menerjemahkan hasil tool itu ke kontrak prefill yang seragam (nama, deskripsi, nominal, dan kasus khusus kalau ada). Transfer internal adalah salah satu kasus khusus yang perlu mapping tersendiri (bukan sekadar nominal+note, kemungkinan perlu akun asal+tujuan).

### Sumber data

Panggil langsung tools MCP Retailku yang sudah ada (lihat `src/shared/retailku/mcp-tools/**`), bukan lewat jalur fetch+agregasi custom seperti desain lama (`fetch-all-cashflow-detail-rows.ts` + `aggregate-by-date-*.ts`).

### Strategi rollout

Mulai dari satu tool dulu (proof of concept) -- end-to-end: pilih tool -> list -> detail -> prefill -> submit manual, untuk SATU tool saja. Dipakai nyata beberapa hari dulu sebelum menambah tools lain atau mempertimbangkan fitur lanjutan (konfigurasi default kategori/akun per-tool).

### Nasib kode lama

`features/retailku/shared/sync/cashflow/**` (proses sync otomatis, agregasi harian) kemungkinan DIHAPUS, tapi baru setelah desain baru ini terbukti matang -- jangan dihapus duluan sebelum penggantinya benar-benar dipakai harian. Kolom `source`/`source_ref` di `transactions`/`debts`/`debt_payments` (lihat `cloud-sync-retailku-provenance-gap.md`) kemungkinan juga jadi tidak relevan lagi kalau kode lama dihapus -- perlu dipikir ulang saat itu tiba, bukan sekarang.

## Belum diputuskan

- Daftar tools MCP yang diekspos di dialog ini.
- Tool mana yang jadi proof-of-concept pertama.
- Bentuk kontrak adapter (interface `TransactionPrefill`, lokasi file per-tool).
- UI detail dialog (layout list, layout detail, loading/error state tiap tool).
- Apakah dialog ini reusable dari halaman lain (mis. halaman Dana Pihak Ketiga) atau khusus halaman Transaksi saja.

## Terkait

- `apps/desktop/docs/todos/plan/cloud-sync-retailku-provenance-gap.md` -- gap provenance di desain LAMA (cloud-sync `source`/`source_ref`), jadi kemungkinan tidak relevan lagi kalau kode lama dihapus sesuai rencana di sini.
- `docs/todos/done/retailku-cashflow-sync.md` -- desain & implementasi sync otomatis lama yang mau digantikan.
- `src/shared/retailku/mcp-tools/**` -- tools MCP Retailku read-only yang sudah ada, jadi sumber data rencana baru ini.
