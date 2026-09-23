"use client";

import { useCashflowConfigContext } from "../config-context";

/** Section "Mapping Akun" — status mapping akun Retailku (ada/belum).
 * Pengaturan mapping sendiri sekarang di tab "Mapping" (sejajar tab ini
 * di halaman yang sama), BUKAN lagi halaman /retailku/mapping terpisah
 * — lihat docs/todos/plan/retailku-sync-field-mapping.md. */
export function MappingStatusSection() {
  const { prerequisites } = useCashflowConfigContext();
  const { mappingsLoading, hasMappings, mappingCount } = prerequisites;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Mapping Akun</h3>
      {mappingsLoading ? (
        <p className="text-muted-foreground text-sm">Memeriksa mapping akun...</p>
      ) : hasMappings ? (
        <p className="text-muted-foreground text-sm">
          {mappingCount} akun Retailku sudah dipetakan. Setiap akun kas Retailku disync ke akun
          lokalnya masing-masing.
        </p>
      ) : (
        <p className="text-destructive text-sm">
          Belum ada mapping akun Retailku. Lengkapi dulu di tab &quot;Mapping&quot;.
        </p>
      )}
    </div>
  );
}
