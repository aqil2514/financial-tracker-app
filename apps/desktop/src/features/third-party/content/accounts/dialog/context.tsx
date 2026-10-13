"use client";

import { createDialogContext } from "@/provider/dialog-state";

export type ThirdPartyAccountDialogType = "create";

const { DialogProvider, useDialog } = createDialogContext<ThirdPartyAccountDialogType>();

export { DialogProvider as ThirdPartyAccountDialogProvider };
export { useDialog as useThirdPartyAccountDialog };
