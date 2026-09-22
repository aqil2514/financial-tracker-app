"use client";

import type { UseFormReturn } from "react-hook-form";

import { EntityForm } from "@/components/forms/entity-form";
import { FormFieldText } from "@/components/forms/form-fields";
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
  submitLabel,
}: AccountGroupFormProps) {
  return (
    <EntityForm form={form} onSubmit={onSubmit} isPending={isPending} submitLabel={submitLabel}>
      <FormFieldText
        form={form}
        name="name"
        label="Nama Group"
        placeholder="Contoh: Aset Lancar"
      />
    </EntityForm>
  );
}
