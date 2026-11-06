import type { LabelFormOutput, LabelFormValues } from "../form/schema";

export interface LabelFormProps {
  defaultValues: LabelFormValues;
  onSubmit: (values: LabelFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
  onDelete?: () => void;
  // Scope tetap sejak label dibuat, jadi dikunci saat edit.
  lockScope?: boolean;
  error?: string | null;
}
