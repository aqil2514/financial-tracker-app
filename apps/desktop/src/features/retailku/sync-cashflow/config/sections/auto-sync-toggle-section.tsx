"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCashflowConfigContext } from "../config-context";

/** Section "Sync Otomatis Saat App Dibuka" — toggle auto-sync,
 * draft+tombol "Simpan" sendiri (fokus section ini). */
export function AutoSyncToggleSection() {
  const { fields } = useCashflowConfigContext();
  const { value: autoSyncEnabled, setDraft, isDirty, handleSave, isSaving } = fields.autoSyncEnabled;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor="auto-sync-toggle">Sync Otomatis Saat App Dibuka</Label>
          <p className="text-muted-foreground text-sm">
            Maksimal 1x per hari, gagal dilaporkan lewat notifikasi tanpa mengganggu.
          </p>
        </div>
        <Switch id="auto-sync-toggle" checked={autoSyncEnabled} onCheckedChange={setDraft} />
      </div>
      {isDirty && (
        <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
          Simpan
        </Button>
      )}
    </div>
  );
}
