// Kurs yang tersimpan selalu per unit. Nilai total dari aplikasi bank dikonversi ke kurs memakai jumlah
// yang dipegang saat itu, supaya nilai terkini tetap benar setelah beli/jual berikutnya.
// Dibulatkan 6 desimal hanya untuk membuang noise floating point, bukan untuk memotong presisi kurs.
export function rateFromTotal(total: number, unit: number): number | null {
  if (!(unit > 0) || !Number.isFinite(total) || total < 0) return null;
  return Math.round((total / unit) * 1e6) / 1e6;
}

export function totalFromRate(rate: number, unit: number): number {
  return Math.round(rate * unit * 100) / 100;
}
