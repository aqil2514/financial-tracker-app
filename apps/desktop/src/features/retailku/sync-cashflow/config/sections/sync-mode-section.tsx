"use client";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { RetailkuCashflowSyncMode } from "@/shared/retailku";
import { useCashflowConfigContext } from "../config-context";

/** Section "Mode Sync Cashflow" — toggle ringkas/detail per kategori,
 * draft+tombol "Simpan" sendiri (fokus section ini). */
export function SyncModeSection() {
  const { fields } = useCashflowConfigContext();
  const { value: mode, setDraft, isDirty, handleSave, isSaving } = fields.mode;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Mode Sync Cashflow</h3>
      <p className="text-muted-foreground text-sm">
        Mode ringkas mencatat 1 transaksi per akun kas Retailku per hari. Mode detail mencatat 1
        transaksi per akun per kategori (sourceType) per hari, lebih granular tapi lebih berat. Ganti
        mode tidak mengubah transaksi yang sudah tersinkron dengan mode sebelumnya.
      </p>
      <ToggleGroup
        value={[mode]}
        onValueChange={(values: string[]) => {
          if (values.length > 0) {
            setDraft(values[values.length - 1] as RetailkuCashflowSyncMode);
          }
        }}
      >
        <ToggleGroupItem value="summary">Mode ringkas</ToggleGroupItem>
        <ToggleGroupItem value="detail">Mode detail per kategori</ToggleGroupItem>
      </ToggleGroup>
      {isDirty && (
        <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
          Simpan
        </Button>
      )}
    </div>
  );
}
