import { BaseForm } from "@/components/forms/base-form";
import { FormFieldDate, FormFieldNumber, FormFieldText } from "@/components/forms/form-fields";
import { editFundFormSchema, type EditFundFormOutput, type EditFundFormValues } from "./schema";

type EditFundFormProps = {
  defaultValues: EditFundFormValues;
  onSubmit: (values: EditFundFormOutput) => void;
  isPending: boolean;
};

export function EditFundForm({ defaultValues, onSubmit, isPending }: EditFundFormProps) {
  return (
    <BaseForm
      schema={editFundFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      isPending={isPending}
      submitLabel="Simpan Perubahan"
    >
      {(form) => (
        <>
          <FormFieldNumber form={form} name="amount" label="Nominal" placeholder="0" prefix="Rp" grouped useCalculator />
          <FormFieldDate form={form} name="date" label="Tanggal" />
          <FormFieldText form={form} name="note" label="Catatan (opsional)" placeholder="Opsional" />
        </>
      )}
    </BaseForm>
  );
}
