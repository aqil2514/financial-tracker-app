"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ThirdPartyAccountDialogProvider,
  ThirdPartyAccountDialogs,
  useThirdPartyAccountDialog,
} from "./dialog";

export function ThirdPartyAccountsSection() {
  return (
    <ThirdPartyAccountDialogProvider>
      <div className="space-y-4">
        <InnerButton />
        <Card>
          <CardHeader>
            <CardTitle>Segera Hadir</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Daftar akun Dana Pihak Ketiga akan tampil di sini. Lihat{" "}
              <code className="text-xs">
                docs/todos/plan/account-type-third-party.md
              </code>{" "}
              untuk status pengerjaannya.
            </p>
          </CardContent>
        </Card>
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
