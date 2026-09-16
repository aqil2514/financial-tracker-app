"use client";

import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { FormFieldText } from "@/components/form-fields";
import type {
  AccountGroupFormOutput,
  AccountGroupFormValues,
} from "./account-group.schema";

type AccountGroupFormProps = {
  form: UseFormReturn<AccountGroupFormValues, unknown, AccountGroupFormOutput>;
  onSubmit: (values: AccountGroupFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
};

export function AccountGroupForm({
  form,
  onSubmit,
  isPending,
  submitLabel = "Simpan",
}: AccountGroupFormProps) {
  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <FormFieldText
        form={form}
        name="name"
        label="Nama Group"
        placeholder="Contoh: Aset Lancar"
      />
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
