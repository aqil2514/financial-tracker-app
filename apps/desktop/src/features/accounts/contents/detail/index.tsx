"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { KeyboardShortcutBadge } from "@/components/keyboard-shortcut-badge";
import { useCreateShortcut } from "@/hooks/use-create-shortcut";
import { AccountsProvider } from "./context";
import { AccountsDialogProvider, AccountsDialogs, useAccountsDialog } from "./dialog";
import { AccountsCardHeader } from "./header";
import { AccountListContent } from "./content";
import { AccountsCardFooter } from "./footer";

function TambahAkunButton() {
  const { openDialog } = useAccountsDialog();

  useCreateShortcut(() => openDialog("create"));

  return (
    <Button onClick={() => openDialog("create")}>
      Tambah Akun
      <KeyboardShortcutBadge shortcut="N" />
    </Button>
  );
}

export function AccountsDetailSection() {
  return (
    <AccountsProvider>
      <AccountsDialogProvider>
        <div className="space-y-4">
          <TambahAkunButton />
          <Card>
            <AccountsCardHeader />
            <AccountListContent />
            <AccountsCardFooter />
          </Card>
        </div>

        <AccountsDialogs />
      </AccountsDialogProvider>
    </AccountsProvider>
  );
}
