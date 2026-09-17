// Locale tampilan aplikasi — satu sumber kebenaran untuk semua formatter
// (tanggal, angka, dst) yang bergantung pada bahasa/wilayah pengguna,
// bukan pada mata uang (lihat format-currency.ts, locale-nya ikut currency).
//
// Saat ini hardcode karena UI baru mendukung Bahasa Indonesia. Kalau i18n
// dibangun, ganti nilai ini agar dibaca dari preferensi user/context,
// tanpa perlu mengubah pemanggil formatDate/dll satu per satu.
export const APP_LOCALE = "id-ID";
