/**
 * Terjemahkan `key` mentah (`"summary:inflow:<uuid>"`,
 * `"detail:<uuid>:SALE:inflow"`, atau
 * `"transfer:<fromUuid>:<toUuid>"`, lihat
 * docs/todos/plan/retailku-sync-field-mapping.md +
 * `extract-transfer-rows.ts`) jadi label manusiawi untuk tabel mapping
 * — akun sendiri ditampilkan terpisah (kolom lain), fungsi ini cuma
 * urus bagian "jenis" (mode+sourceType+arah).
 */
export function formatMappingKeyLabel(key: string): string {
  const parts = key.split(":");
  const mode = parts[0];

  if (mode === "transfer") {
    return "Transfer dana";
  }

  const direction = mode === "summary" ? parts[1] : parts[parts.length - 1];
  const directionLabel = direction === "inflow" ? "Uang masuk" : "Uang keluar";

  if (mode === "summary") {
    return `Ringkasan — ${directionLabel}`;
  }

  // detail:<accountId>:<sourceType>:<direction>
  const sourceType = parts[2];
  return `${sourceType} — ${directionLabel}`;
}
