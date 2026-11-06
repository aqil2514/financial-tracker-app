"use client";

import type { UseFormReturn } from "react-hook-form";

import { EntityForm } from "@/components/forms/entity-form";
import { FormFieldText, FormFieldToggleGroup } from "@/components/forms/form-fields";
import { LABEL_SCOPE_OPTIONS, type LabelFormOutput, type LabelFormValues } from "./label.schema";

type LabelFormProps = {
  form: UseFormReturn<LabelFormValues, unknown, LabelFormOutput>;
  onSubmit: (values: LabelFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
  lockScope?: boolean;
};

export function LabelForm({ form, onSubmit, isPending, submitLabel, lockScope }: LabelFormProps) {
  return (
    <EntityForm form={form} onSubmit={onSubmit} isPending={isPending} submitLabel={submitLabel}>
      <FormFieldText form={form} name="name" label="Nama" placeholder="Contoh: Liburan" />
      <FormFieldToggleGroup
        form={form}
        name="scope"
        label="Berlaku untuk"
        description={lockScope ? "Scope label tidak bisa diubah setelah dibuat." : undefined}
        options={LABEL_SCOPE_OPTIONS}
        disabled={lockScope}
      />
    </EntityForm>
  );
}
