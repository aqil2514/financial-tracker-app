import { PageHeader } from "@/components/page-header";
import { NewDebtDialog } from "@/shared/debts/new-debt-form/new-debt-dialog";

export function DebtsSummaryHeader() {
  return (
    <PageHeader
      title="Ringkasan Kontak"
      description="Rangkuman piutang dan utang per kontak"
      actions={<NewDebtDialog />}
    />
  );
}
