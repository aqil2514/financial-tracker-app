# Rencana Integrasi dengan Retailku

## Latar belakang

Disebutkan eksplisit di `Proposal.docx` (Retailku, section "7. Rencana
Pengembangan", jalur kedua/faktor internal — "rencana yang PASTI akan
dikerjakan dalam jangka menengah, tanpa menunggu sinyal apa pun dari
luar"):

> "...misal tools pencatatan keuangan pribadi yang terintegrasi dengan
> Retailku. Ini bukan ide baru, melainkan kelanjutan dari kebiasaan yang
> sudah berjalan sejak 2022, yaitu pencatatan keuangan pribadi yang
> dilakukan dengan menggunakan Excel. Pada tahun 2024, sempat berpindah
> ke aplikasi eksternal. Semenjak mulai bisnis di tahun 2025, baru pain
> point yang terjadi cukup terasa... Setiap harinya, saya harus input ke
> dua sistem yang berbeda (Retailku dan aplikasi eksternal) agar datanya
> sinkron. Tujuannya sederhana, agar input data ini cukup sekali dan itu
> bisa menjadi satu ekosistem digital yang saling sinkron satu sama
> lainnya."

Jadi `financial-app` (aplikasi ini) BUKAN cuma proyek pencatatan keuangan
personal berdiri sendiri — motivasi jangka panjangnya adalah menggantikan
"aplikasi eksternal" yang disebut di proposal itu, lalu diintegrasikan
dengan Retailku (platform akuntansi/operasional toko multitenant milik
sendiri, stack NestJS + Next.js + PostgreSQL/Prisma) supaya input data
transaksi keuangan pribadi vs bisnis tidak perlu dilakukan dua kali.

## Implikasi untuk arah pengembangan aplikasi ini

Ini BUKAN todo teknis konkret dengan langkah eksekusi — statusnya masih
"arah strategis yang perlu diantisipasi", bukan spesifikasi fitur. Yang
perlu dipertimbangkan ke depan supaya tidak menutup jalan integrasi:

- **Aplikasi ini Tauri (desktop, SQLite lokal)**, Retailku web (NestJS API
  + PostgreSQL, multitenant). Sinkronisasi lintas dua sistem dengan
  arsitektur data yang beda total (lokal-first vs cloud multitenant) akan
  butuh lapisan sync/API tersendiri — belum ada bentuknya sama sekali
  saat ini.
- Skema data aplikasi ini (`transactions`, `accounts`, `categories`,
  dll — lihat migrasi di `src-tauri/migrations/`) kemungkinan perlu
  mapping eksplisit ke skema akuntansi double-entry Retailku (jurnal,
  akun) kalau integrasi nanti benar dibangun — TIDAK berarti skema
  aplikasi ini harus jadi double-entry dari sekarang, sekadar dicatat
  supaya keputusan skema di masa depan tidak mengejutkan.
- Filter/sort/pagination generik (`components/query/`) dan pola
  `useDbMutation`/`useEntityForm` yang sudah dibangun di aplikasi ini
  kemungkinan bisa jadi referensi pola kalau nanti perlu dibuat lapisan
  sync — tapi ini spekulatif, belum ada keputusan konkret.

## Catatan

Proposal secara eksplisit menyebut rencana ini masuk jalur yang PASTI
dikerjakan (bukan jalur eksternal yang menunggu sinyal), tapi tidak ada
tenggat waktu spesifik disebutkan — hanya "jangka menengah". Dokumen ini
dicatat supaya konteks strategis ini tidak hilang dan bisa jadi
pertimbangan kalau ke depan ada keputusan arsitektur besar (skema
database, format export/import data, dll) yang berpotensi mempermudah
atau mempersulit integrasi nanti — bukan untuk dieksekusi sekarang.
