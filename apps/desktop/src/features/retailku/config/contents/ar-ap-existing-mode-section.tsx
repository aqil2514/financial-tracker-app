"use client";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { RetailkuArApExistingMode } from "../../shared/sync";
import { useRetailkuSyncCashflowConfig } from "../context";

/** Section "Piutang/Utang Sudah Tersinkron" — perlakuan baris AR/AP yang
 * source_ref-nya sudah pernah tersimpan sebagai debts sebelumnya. */
export function ArApExistingModeSection() {
  const { fields } = useRetailkuSyncCashflowConfig();
  const { value: existingMode, setDraft, isDirty, handleSave, isSaving } = fields.arApExistingMode;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Piutang/Utang Sudah Tersinkron</h3>
      <p className="text-muted-foreground text-sm">
        Lewati (default) membiarkan piutang/utang yang sudah pernah tersinkron apa adanya. Timpa
        ulang memperbarui baris yang sudah ada (nominal/akun/kontak) dengan data terbaru dari
        Retailku.
      </p>
      <ToggleGroup
        value={[existingMode]}
        onValueChange={(values: string[]) => {
          if (values.length > 0) {
            setDraft(values[values.length - 1] as RetailkuArApExistingMode);
          }
        }}
      >
        <ToggleGroupItem value="skip">Lewati</ToggleGroupItem>
        <ToggleGroupItem value="overwrite">Timpa ulang</ToggleGroupItem>
      </ToggleGroup>
      {isDirty && (
        <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
          Simpan
        </Button>
      )}
    </div>
  );
}
