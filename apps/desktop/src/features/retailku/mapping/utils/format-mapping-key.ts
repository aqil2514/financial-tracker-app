/**
 * Terjemahkan `key` mentah (`"summary:inflow:<uuid>"`,
 * `"detail:<uuid>:SALE:inflow"`, `"transfer:<fromUuid>:<toUuid>"`, atau
 * `"ar_ap:<accountId>:<direction>"`, lihat
 * docs/todos/plan/retailku-sync-field-mapping.md +
 * `extract-transfer-rows.ts`/`extract-ar-ap-rows.ts`) jadi label
 * manusiawi untuk tabel mapping — akun/pihak sendiri ditampilkan
 * terpisah (kolom lain), fungsi ini cuma urus bagian "jenis"
 * (mode+sourceType+arah). PENTING: cabang `ar_ap` HARUS eksplisit
 * (BUKAN jatuh ke logic `detail:` di bawah) — `parts[2]` di key ar_ap
 * adalah `direction` (`receivable`/`payable`), BUKAN `sourceType`
 * seperti asumsi cabang detail, salah parse kalau digabung (sama bug
 * yg pernah terjadi di key transfer sebelum diberi cabang sendiri).
 */
export function formatMappingKeyLabel(key: string): string {
  const parts = key.split(":");
  const mode = parts[0];

  if (mode === "transfer") {
    return "Transfer dana";
  }

  if (mode === "ar_ap") {
    const direction = parts[2];
    return direction === "receivable" ? "Piutang" : "Utang";
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
