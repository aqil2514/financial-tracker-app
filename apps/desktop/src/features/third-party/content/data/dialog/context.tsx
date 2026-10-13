"use client";

import { createDialogContext } from "@/provider/dialog-state";

export type ThirdPartyDialogType = "create";

const { DialogProvider, useDialog } = createDialogContext<ThirdPartyDialogType>();

export { DialogProvider as ThirdPartyDialogProvider };
export { useDialog as useThirdPartyDialog };
