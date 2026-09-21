"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCashflowConfigContext } from "../config-context";

/** Section "Akun Kas untuk Utang Piutang" — sisi kas dari transaksi
 * transfer piutang/utang baru, independen dari mapping cashflow.
 * Draft+tombol "Simpan" sendiri (fokus section ini). */
export function ArApCashAccountSection() {
  const { prerequisites, fields } = useCashflowConfigContext();
  const { cashAccountOptions } = prerequisites;
  const { value: arApCashAccountId, setDraft, isDirty, handleSave, isSaving } = fields.arApCashAccountId;

  const selectValue = arApCashAccountId?.toString() ?? "";

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Akun Kas untuk Utang Piutang</h3>
      <p className="text-muted-foreground text-sm">
        Sisi kas dari transaksi transfer piutang/utang baru — independen dari mapping cashflow per akun
        di atas.
      </p>
      <Select value={selectValue} onValueChange={(value) => setDraft(value ? Number(value) : null)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Pilih akun kas...">
            {(value: string | null) =>
              cashAccountOptions.find((a) => String(a.id) === value)?.name ?? "Pilih akun kas..."
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {cashAccountOptions.map((account) => (
            <SelectItem key={account.id} value={String(account.id)}>
              {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isDirty && (
        <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
          Simpan
        </Button>
      )}
    </div>
  );
}
