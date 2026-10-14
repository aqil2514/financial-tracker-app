import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { KeyboardShortcutBadge } from "@/components/keyboard-shortcut-badge";
import { useCreateShortcut } from "@/hooks/use-create-shortcut";
import { useTransactionsDialog } from "../dialog";

export function TransactionsHeader() {
  const { openDialog } = useTransactionsDialog();

  useCreateShortcut(() => openDialog("create"));

  return (
    <PageHeader
      title="Transaksi"
      description="Kelola seluruh transaksi keuangan Anda"
      actions={
        <Button onClick={() => openDialog("create")}>
          Tambah Transaksi
          <KeyboardShortcutBadge shortcut="N" />
        </Button>
      }
    />
  );
}
