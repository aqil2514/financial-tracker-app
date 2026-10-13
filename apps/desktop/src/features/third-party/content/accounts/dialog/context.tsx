"use client";

import { createDialogQueryContext } from "@/provider/dialog-query-state";

export type ThirdPartyAccountDialogType = "create";

const { DialogProvider, useDialog } = createDialogQueryContext<ThirdPartyAccountDialogType>();

export { DialogProvider as ThirdPartyAccountDialogProvider };
export { useDialog as useThirdPartyAccountDialog };
