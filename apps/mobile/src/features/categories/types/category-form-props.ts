import { CategoryFormOutput, CategoryFormValues } from "../form/schema";

export interface CategoryFormProps {
  defaultValues: CategoryFormValues;
  onSubmit: (values: CategoryFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
  // Dibutuhkan saat edit — kategori tidak boleh jadi induk dirinya sendiri.
  excludeId?: string;
  onDelete?: () => void;
}
