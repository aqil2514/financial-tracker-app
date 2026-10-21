"use client";

import { Button } from "@/components/ui/button";
import { ThirdPartyDialogProvider, ThirdPartyDialogs, useThirdPartyDialog } from "./dialog";
import { ThirdPartyFundList } from "./list";

function DataActions() {
  const { openDialog } = useThirdPartyDialog();

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => openDialog("create")}>
        Catat Titip/Ambil
      </Button>
      <Button variant="outline" onClick={() => openDialog("transfer")}>
        Pindah Tempat/Kepemilikan
      </Button>
    </div>
  );
}

export function ThirdPartyDataSection() {
  return (
    <ThirdPartyDialogProvider>
      <div className="space-y-4">
        <DataActions />
        <ThirdPartyFundList />
      </div>

      <ThirdPartyDialogs />
    </ThirdPartyDialogProvider>
  );
}
