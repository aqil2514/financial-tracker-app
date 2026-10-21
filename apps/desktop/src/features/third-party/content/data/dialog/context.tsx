"use client";

import { createDialogQueryContext } from "@/provider/dialog-query-state";

export type ThirdPartyDialogType = "create" | "transfer";

const { DialogProvider, useDialog } = createDialogQueryContext<ThirdPartyDialogType>();

export { DialogProvider as ThirdPartyDialogProvider };
export { useDialog as useThirdPartyDialog };
