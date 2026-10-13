# `use-create-transaction`

Hook mutation create transaksi — masih pakai `useEntityForm` (bukan
`useDbMutation`+`BaseForm` seperti pola `features/accounts`). Logic
mutation murni dipisah ke folder `create-transaction/` (fungsi
`createTransaction`, lihat README di situ untuk alurnya), `index.ts`
tinggal pasang sebagai `mutationFn` + urus `defaultValues`/`onSuccess`
(sisi React/dialog).

## `type.ts` — `UseCreateTransactionOptions`

- `open` — dialog terbuka atau tidak, datang dari context, dipakai
  untuk `resetOnOpen`.
- `getPendingAttachments` — lampiran yang ditangkap sebelum transaksi
  tersimpan, diproses (disimpan ke disk + database) setelah insert
  transaksi berhasil, karena baru di titik itu `transaction_id`-nya
  diketahui. Dibaca lewat getter (bukan array langsung) supaya selalu
  ambil state terbaru dari form saat submit terjadi, bukan snapshot
  saat hook di-mount.
- `onClosed` — dipanggil setelah transaksi (dan lampirannya, kalau ada)
  selesai tersimpan, HANYA saat bukan "Simpan & Lanjut", supaya
  pemanggil bisa menutup dialog dari context. Saat "Simpan & Lanjut",
  dialog tetap terbuka dan ini TIDAK dipanggil.
- `defaultAccountId` — akun yang otomatis dipilih saat form dibuka,
  dipakai halaman detail akun supaya transaksi baru langsung ter-scope
  ke akun yang sedang dilihat, tanpa user perlu memilih lagi.

## `index.ts` — `onSuccess`

Transaksinya sendiri sudah tersimpan di titik `onSuccess` dipanggil —
kegagalan menyimpan lampiran TIDAK boleh dilempar sebagai error mutation
(`useDbMutation.onError` hanya menangkap error dari `mutationFn`, bukan
dari `onSuccess`), jadi ditangani sendiri lewat try/catch supaya user
tetap dapat feedback yang jelas alih-alih unhandled rejection.

Dialog/form tetap reset setelah `onSuccess` (perilaku `useEntityForm`) —
pending attachments yang gagal tidak bisa "dicoba ulang" dari form yang
sudah reset, jadi `onAttachmentsSaved` tetap dipanggil baik sukses
maupun gagal supaya tidak ada state foto "hantu" yang tersisa.

BELUM direfactor ke `useDbMutation`+`BaseForm` — ditunda sampai form
transaksi (`components/index.tsx` dan sekitarnya) selesai dirombak ke
pola baru, supaya tidak dikerjakan dua kali.
