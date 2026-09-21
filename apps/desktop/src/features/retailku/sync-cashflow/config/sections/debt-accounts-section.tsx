"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCashflowConfigContext } from "../config-context";

/** Section "Akun Utang Piutang" — 2 field akun debt lokal terpisah
 * (piutang & utang), draft GABUNGAN dengan SATU tombol "Simpan" untuk
 * keduanya (fokus section ini). */
export function DebtAccountsSection() {
  const { prerequisites, debtAccounts } = useCashflowConfigContext();
  const { debtAccountOptions } = prerequisites;
  const { receivableDebtAccountId, setReceivableDraft, payableDebtAccountId, setPayableDraft, isDirty, handleSave, isSaving } =
    debtAccounts;

  const receivableValue = receivableDebtAccountId?.toString() ?? "";
  const payableValue = payableDebtAccountId?.toString() ?? "";

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Akun Utang Piutang</h3>
      <p className="text-muted-foreground text-sm">
        Piutang dan utang gabungan dari Retailku dicatat lewat akun bertipe &quot;Utang Piutang&quot; ini
        — buat dulu di Master Data &gt; Akun kalau belum ada.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Akun untuk Piutang</Label>
          <Select
            value={receivableValue}
            onValueChange={(value) => setReceivableDraft(value ? Number(value) : null)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih akun...">
                {(value: string | null) =>
                  debtAccountOptions.find((a) => String(a.id) === value)?.name ?? "Pilih akun..."
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {debtAccountOptions.map((account) => (
                <SelectItem key={account.id} value={String(account.id)}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Akun untuk Utang</Label>
          <Select value={payableValue} onValueChange={(value) => setPayableDraft(value ? Number(value) : null)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih akun...">
                {(value: string | null) =>
                  debtAccountOptions.find((a) => String(a.id) === value)?.name ?? "Pilih akun..."
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {debtAccountOptions.map((account) => (
                <SelectItem key={account.id} value={String(account.id)}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {isDirty && (
        <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
          Simpan
        </Button>
      )}
    </div>
  );
}
