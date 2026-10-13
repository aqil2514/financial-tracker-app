"use client";

import { Button } from "@/components/ui/button";
import {
  ThirdPartyAccountDialogProvider,
  ThirdPartyAccountDialogs,
  useThirdPartyAccountDialog,
} from "./dialog";
import { ThirdPartyAccountList } from "./list";

export function ThirdPartyAccountsSection() {
  return (
    <ThirdPartyAccountDialogProvider>
      <div className="space-y-4">
        <InnerButton />
        <ThirdPartyAccountList />
      </div>

      <ThirdPartyAccountDialogs />
    </ThirdPartyAccountDialogProvider>
  );
}

const InnerButton = () => {
  const { openDialog } = useThirdPartyAccountDialog();

  return (
    <Button variant="outline" onClick={() => openDialog("create")}>
      Tambah Akun
    </Button>
  );
};
