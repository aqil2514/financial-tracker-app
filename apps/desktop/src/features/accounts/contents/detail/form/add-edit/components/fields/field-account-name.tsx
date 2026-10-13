import { FormFieldText } from "@/components/forms/form-fields";
import { useFormContext } from "react-hook-form";

export function FieldAccountName() {
  const form = useFormContext();
  return (
    <FormFieldText
      form={form}
      name="name"
      label="Nama Akun"
      placeholder="Contoh: Kartu Kredit"
    />
  );
}
