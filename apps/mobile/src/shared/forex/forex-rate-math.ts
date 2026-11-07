// Kurs yang tersimpan selalu per unit. Nilai total dari aplikasi bank ("Nilai IDR") dikonversi ke kurs memakai jumlah
// unit saat itu. Dibulatkan 6 desimal hanya untuk membuang noise floating point, bukan untuk memotong presisi kurs.
export function rateFromTotal(total: number, unit: number): number | null {
  if (!(unit > 0) || !Number.isFinite(total) || total < 0) return null;
  return Math.round((total / unit) * 1e6) / 1e6;
}

export function totalFromRate(rate: number, unit: number): number {
  return Math.round(rate * unit * 100) / 100;
}
