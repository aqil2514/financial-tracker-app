# Format dokumen `docs/todos/*`

Berlaku untuk semua `docs/todos/plan/*.md` dan `docs/todos/done/*.md` di
semua app pada monorepo ini (`apps/desktop/docs/todos/`,
`apps/worker/docs/todos/`, dst).

## Ringkasan status di paling atas

Dokumen todo yang sudah panjang (riwayat diskusi, keputusan desain,
revisi) WAJIB punya bagian ringkasan status di paling atas file —
sebelum "Latar belakang"/konteks lainnya — supaya pembaca tidak perlu
scroll jauh ke bawah untuk tahu progres saat ini. Judulnya bebas (mis.
"Status & TODO saat ini (ringkas)"), tapi isinya WAJIB:

- Satu daftar checklist TUNGGAL (bukan dipisah "sudah selesai" prosa +
  "belum" checklist) — item selesai `- [x]`, item belum `- [ ]`, dicampur
  dalam satu daftar yang sama.
- Satu baris per item, ringkas (bukan rangkuman ulang detail teknis).
- Kalau alasan/konteks sebuah item perlu penjelasan panjang, JANGAN
  ditulis di ringkasan ini — cukup arahkan pembaca ke bagian detail di
  bawah (mis. "lihat bagian Catatan di bawah").

Isi lengkap/riwayat diskusi di bawah ringkasan ini TETAP dipertahankan
apa adanya (jangan dihapus/diringkas) — ringkasan di atas cuma lapisan
navigasi cepat, bukan pengganti detailnya.

## Contoh

```markdown
# Judul Fitur

## Status & TODO saat ini (ringkas)

Penjelasan lengkap kenapa tiap poin ada di sini — lihat bagian
"Catatan" di bawah.

- [x] Skema database + migrasi teregistrasi.
- [x] Logic inti sudah diverifikasi live.
- [ ] Poles UI — filter, empty state.
- [ ] Keputusan X belum diambil.

## Latar belakang
...
```

Lihat `apps/desktop/docs/todos/plan/debt-receivable-tracking.md` sebagai
contoh penerapan nyata.
