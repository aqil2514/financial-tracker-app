import { ContactFormOutput, ContactFormValues } from "../form/schema";

export interface ContactFormProps {
  defaultValues: ContactFormValues;
  onSubmit: (values: ContactFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
  onDelete?: () => void;
}
