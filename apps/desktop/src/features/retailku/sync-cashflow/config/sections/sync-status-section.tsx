"use client";

import { useCashflowConfigContext } from "../config-context";

/** Section "Status Sinkronisasi" — tanggal sync otomatis terakhir. */
export function SyncStatusSection() {
  const { fields } = useCashflowConfigContext();
  const { lastAutoSyncDate } = fields;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Status Sinkronisasi</h3>
      <p className="text-muted-foreground text-sm">
        {lastAutoSyncDate ? `Sync otomatis terakhir: ${lastAutoSyncDate}` : "Belum pernah disinkron otomatis."}
      </p>
    </div>
  );
}
