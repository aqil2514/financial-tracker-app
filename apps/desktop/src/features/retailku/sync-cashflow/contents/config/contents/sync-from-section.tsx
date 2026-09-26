"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRetailkuSyncCashflowConfig } from "../context";

/** Section "Titik Awal Sync" — draft tanggal + tombol "Simpan"
 * sendiri (fokus section ini). */
export function SyncFromSection() {
  const { fields, syncFrom } = useRetailkuSyncCashflowConfig();
  const { syncSettingsLoading } = fields;
  const { syncFromValue, savedSyncFrom, syncFromDraft, setSyncFromDraft, handleSaveSyncFrom, isSaving } =
    syncFrom;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Titik Awal Sync</h3>
      <p className="text-muted-foreground text-sm">
        Sync berikutnya memproses dari tanggal ini sampai hari ini. Maju otomatis setelah sync berhasil —
        bisa diedit manual kapan saja.
      </p>
      {syncSettingsLoading ? (
        <p className="text-muted-foreground text-sm">Memuat...</p>
      ) : (
        <div className="flex items-end gap-2">
          <Input
            type="date"
            value={syncFromValue}
            onChange={(e) => setSyncFromDraft(e.target.value)}
            className="w-fit"
          />
          {syncFromDraft != null && syncFromDraft !== savedSyncFrom && (
            <Button variant="outline" size="sm" onClick={handleSaveSyncFrom} disabled={isSaving}>
              Simpan
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
