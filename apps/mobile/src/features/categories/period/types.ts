import type { CategoryPeriodFormOutput, CategoryPeriodFormValues } from "./form/schema";

export interface CategoryPeriodFormProps {
  defaultValues: CategoryPeriodFormValues;
  onSubmit: (values: CategoryPeriodFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
  onDelete?: () => void;
}

export interface CategoryPeriodListItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  categoryNames: string;
  isOngoing: boolean;
}
