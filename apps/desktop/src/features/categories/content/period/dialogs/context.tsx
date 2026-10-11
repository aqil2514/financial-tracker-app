"use client";

import { createDialogContext } from "@/provider/dialog-state";

export type CategoryPeriodDialogType = "create";

const { DialogProvider, useDialog } = createDialogContext<CategoryPeriodDialogType>();

export { DialogProvider as CategoryPeriodDialogProvider };
export { useDialog as useCategoryPeriodDialog };
