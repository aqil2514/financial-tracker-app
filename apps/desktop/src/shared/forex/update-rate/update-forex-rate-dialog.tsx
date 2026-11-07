"use client";

import { Pencil } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { getDb } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { dependentKeysOf } from "@/lib/query-dependencies";
import { useForexAccount } from "../use-forex-account";
import { useForexHoldingSummary } from "../use-forex-queries";
import { RateOrTotalField } from "./rate-or-total-field";

const updateForexRateSchema = z.object({
  current_rate: z.coerce.number().positive("Nilai harus lebih dari 0"),
});

type FormOutput = z.output<typeof updateForexRateSchema>;

// Update kurs terkini tidak membuat transaksi dan tidak mengubah accounts.balance.
// Yang tersimpan selalu kurs per unit; mode "Nilai total" hanya cara mengisinya.
// Belum ada push ke Worker: sync valas menyusul.
export function UpdateForexRateDialog({ accountId, currentRate }: { accountId: string; currentRate: number }) {
  const { data: holding } = useForexHoldingSummary(accountId);
  const { data: forexAccount } = useForexAccount(accountId);

  const { open, setOpen, form, onSubmit, isPending } = useEntityForm({
    schema: updateForexRateSchema,
    defaultValues: () => ({ current_rate: currentRate }),
    resetOnOpen: true,
    mutationFn: async (values: FormOutput) => {
      const db = await getDb();
      await db.execute(
        "UPDATE forex_accounts SET current_rate = $1, updated_at = datetime('now') WHERE account_id = $2",
        [values.current_rate, accountId]
      );
    },
    invalidateKey: dependentKeysOf("accounts"),
    successMessage: "Nilai terkini berhasil diperbarui",
    errorMessage: "Gagal memperbarui nilai terkini",
  });

  return (
    <EntityFormDialog
      trigger={
        <Button variant="ghost" size="icon-xs">
          <Pencil className="size-3" />
        </Button>
      }
      title="Update Nilai Terkini"
      open={open}
      onOpenChange={setOpen}
      contentClassName="sm:!max-w-md"
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <RateOrTotalField
          form={form}
          name="current_rate"
          remainingUnit={holding?.remainingUnit ?? 0}
          currency={forexAccount?.currency ?? ""}
        />
        <DialogFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </form>
    </EntityFormDialog>
  );
}
