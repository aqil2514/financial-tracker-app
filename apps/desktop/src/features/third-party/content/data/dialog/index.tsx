import { ThirdPartyCreateDialog } from "./create";
import { ThirdPartyTransferDialog } from "./transfer";

export function ThirdPartyDialogs() {
  return (
    <>
      <ThirdPartyCreateDialog />
      <ThirdPartyTransferDialog />
    </>
  );
}

export { ThirdPartyDialogProvider, useThirdPartyDialog } from "./context";
