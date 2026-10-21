"use client";

import { useThirdPartyAccountDialog } from "./context";
import { ThirdPartyCreateAccountDialog } from "./create";
import { ThirdPartyEditAccountDialog } from "./edit";
import { ThirdPartyDeleteAccountDialog } from "./delete";

export function ThirdPartyAccountDialogs() {
  const { dialog } = useThirdPartyAccountDialog();

  if (dialog?.type === "create") return <ThirdPartyCreateAccountDialog />;
  if (dialog?.type === "edit") return <ThirdPartyEditAccountDialog />;
  if (dialog?.type === "delete") return <ThirdPartyDeleteAccountDialog />;
  return null;
}

export { ThirdPartyAccountDialogProvider, useThirdPartyAccountDialog } from "./context";
