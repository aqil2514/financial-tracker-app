"use client";

import { useThirdPartyAccountDialog } from "./context";
import { ThirdPartyCreateAccountDialog } from "./create";

export function ThirdPartyAccountDialogs() {
  const { dialog } = useThirdPartyAccountDialog();

  return dialog?.type === "create" ? <ThirdPartyCreateAccountDialog /> : null;
}

export { ThirdPartyAccountDialogProvider, useThirdPartyAccountDialog } from "./context";
