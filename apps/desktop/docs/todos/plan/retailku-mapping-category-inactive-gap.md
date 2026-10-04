# Mapping Retailku — Opsi Kategori Tidak Filter `is_active`

## Status & TODO saat ini (ringkas)

- [ ] Opsi kategori di mapping Retailku (`use-resources.ts`) tidak
      filter `is_active` — kategori nonaktif tetap jadi pilihan valid
      saat mapping field Retailku. Perlu dicek dulu behavior mapping
      LAMA yang sudah menunjuk ke kategori yang KEMUDIAN dinonaktifkan
      sebelum tahu bentuk fix yang benar (lihat "Kenapa bukan fix satu
      baris" di bawah) — bukan dikerjakan berdiri sendiri, perlu sesi
      khusus Retailku.

## Latar belakang

Dipindahkan 2026-10-05 dari
`apps/desktop/docs/todos/plan/category-is-active-gaps.md` (dokumen itu
audit gap `is_active` kategori secara umum — dua temuan lain di
dokumen itu, laporan breakdown kategori & keputusan filter list
kategori, sudah dibereskan di sesi yang sama; sisa satu ini murni soal
Retailku jadi dipindah ke sini agar tidak campur topik).

Audit ad-hoc 2026-10-04 (trigger: pertanyaan "apakah `is_active` cuma
dipakai di Akun?") menemukan `use-resources.ts`
(`apps/desktop/src/features/retailku/mapping/context/hooks/`) membangun
`categoryOptions` langsung dari `categories ?? []` apa adanya, TANPA
filter `is_active` — kontras dengan `accountOptions`/`debtAccountOptions`
di file yang sama yang sudah filter `is_active` eksplisit:

```ts
accountOptions: (localAccounts ?? []).filter(
  (account) => account.is_active && account.account_type === "cash",
),
debtAccountOptions: (localAccounts ?? []).filter(
  (account) => account.is_active && account.account_type === "debt",
),
categoryOptions: categories ?? [],   // <- tidak difilter
contactOptions: contacts ?? [],
```

Dampak: kategori yang sudah dinonaktifkan user tetap muncul sebagai
pilihan valid saat memetakan field Retailku ke kategori lokal.

## Kenapa bukan fix satu baris

Beda dari sekadar nambah `.filter(c => c.is_active)`, perlu dipikirkan
dulu: bagaimana kalau ada mapping LAMA yang sudah menunjuk ke kategori
yang KEMUDIAN dinonaktifkan user? Kalau opsi langsung difilter penuh,
mapping existing itu bisa jadi tidak valid/hilang dari tampilan tanpa
alasan jelas ke user.

Pola pembanding yang sudah ada di codebase: dropdown kategori di form
transaksi menangani kasus serupa dengan "exception — tetap muncul kalau
sedang dipakai" (filter `is_active` TAPI kategori yang sedang terpasang
di record yang diedit tetap ditampilkan). Mapping Retailku kemungkinan
butuh pola yang sama, tapi perlu verifikasi dulu bagaimana behavior
mapping existing saat ini (apakah disimpan sebagai id kategori, dan
apakah ada tempat lain yang resolve id itu balik ke kategori yang
sudah nonaktif) sebelum menentukan bentuk fix-nya.

## Referensi

- `apps/desktop/src/features/retailku/mapping/context/hooks/use-resources.ts`
  — lokasi `categoryOptions` yang belum difilter.
- `apps/desktop/src/features/retailku/config/context/hooks/use-sync-prerequisites.ts`
  — pembanding, opsi akun Retailku yang SUDAH filter `is_active`
  eksplisit.
