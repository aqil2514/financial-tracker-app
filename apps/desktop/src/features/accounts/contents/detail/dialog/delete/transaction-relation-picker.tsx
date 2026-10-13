"use client";

import type { Account } from "@/lib/db";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type RelationAction = "unassign" | "reassign";

/** Pilihan apa yang terjadi pada transaksi yang masih merujuk akun ini
 * saat akun dihapus — lepas ke "Tanpa Akun", atau pindahkan ke akun lain. */
export function TransactionRelationPicker({
  transactionAction,
  onTransactionActionChange,
  targetAccountId,
  onTargetAccountIdChange,
  otherAccounts,
}: {
  transactionAction: RelationAction;
  onTransactionActionChange: (action: RelationAction) => void;
  targetAccountId: string | null;
  onTargetAccountIdChange: (id: string | null) => void;
  otherAccounts: Account[];
}) {
  return (
    <div className="space-y-2">
      <ToggleGroup
        value={[transactionAction]}
        onValueChange={(values: string[]) => {
          if (values.length > 0) {
            onTransactionActionChange(values[values.length - 1] as RelationAction);
          }
        }}
        className="w-full"
      >
        <ToggleGroupItem value="unassign" className="flex-1">
          Lepas ke Tanpa Akun
        </ToggleGroupItem>
        <ToggleGroupItem
          value="reassign"
          className="flex-1"
          disabled={otherAccounts.length === 0}
        >
          Pindahkan ke akun lain
        </ToggleGroupItem>
      </ToggleGroup>
      {transactionAction === "reassign" && (
        <Select value={targetAccountId ?? ""} onValueChange={onTargetAccountIdChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pilih akun tujuan...">
              {(value: string | null) =>
                otherAccounts.find((a) => String(a.id) === value)?.name ??
                "Pilih akun tujuan..."
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {otherAccounts.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
