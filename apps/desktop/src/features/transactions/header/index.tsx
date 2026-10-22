import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { KeyboardShortcutBadge } from "@/components/keyboard-shortcut-badge";
import { useCreateShortcut } from "@/hooks/use-create-shortcut";
import { useRetailkuDialog } from "@/shared/retailku";
import { useTransactionsDialog } from "../dialog";

export function TransactionsHeader() {
  const { openDialog } = useTransactionsDialog();
  const { openDialog: openRetailkuDialog } = useRetailkuDialog();

  useCreateShortcut(() => openDialog("create"));

  return (
    <PageHeader
      title="Transaksi"
      description="Kelola seluruh transaksi keuangan Anda"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => openRetailkuDialog("picker")}>
            Ambil dari Retailku
          </Button>
          <Button onClick={() => openDialog("create")}>
            Tambah Transaksi
            <KeyboardShortcutBadge shortcut="N" />
          </Button>
        </div>
      }
    />
  );
}
