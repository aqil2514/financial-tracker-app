export interface LimitOffsetResult {
  clause: string;
  params: [number, number];
}

/**
 * Menerjemahkan page/limit jadi klausa `LIMIT $n OFFSET $m` siap
 * disisipkan ke query SQLite, dengan index parameter dihitung otomatis
 * dari `startIndex` (posisi parameter berikutnya setelah WHERE/ORDER BY
 * yang sudah ada) — pemanggil tidak perlu menghitung `params.length + 1`
 * secara manual, kelas kesalahan yang sama dengan bug index placeholder
 * yang pernah terjadi di buildWhereClause.
 *
 * `startIndex` adalah nomor placeholder pertama yang boleh dipakai
 * (1-based) — biasanya `params.length + 1` dari whereClause yang sudah
 * dibangun sebelumnya.
 */
export function buildLimitOffset(
  page: number,
  limit: number,
  startIndex: number
): LimitOffsetResult {
  const offset = (page - 1) * limit;
  return {
    clause: `LIMIT $${startIndex} OFFSET $${startIndex + 1}`,
    params: [limit, offset],
  };
}
