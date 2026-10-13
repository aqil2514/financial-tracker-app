"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThirdPartyDialogProvider, ThirdPartyDialogs, useThirdPartyDialog } from "./dialog";

function CatatTitipAmbilButton() {
  const { openDialog } = useThirdPartyDialog();

  return (
    <Button variant="outline" onClick={() => openDialog("create")}>
      Catat Titip/Ambil
    </Button>
  );
}

export function ThirdPartyDataSection() {
  return (
    <ThirdPartyDialogProvider>
      <div className="space-y-4">
        <CatatTitipAmbilButton />
        <Card>
          <CardHeader>
            <CardTitle>Segera Hadir</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Riwayat titip/ambil dana pihak ketiga akan tampil di sini. Lihat{" "}
              <code className="text-xs">docs/todos/plan/account-type-third-party.md</code> untuk
              status pengerjaannya.
            </p>
          </CardContent>
        </Card>
      </div>

      <ThirdPartyDialogs />
    </ThirdPartyDialogProvider>
  );
}
