"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AccountWithBalance } from "../../../../calculate-balance";
import { AccountBalanceCorrectionForm, useBalanceCorrectionForm } from "../../form/balance-correction";
import { isAccountTypeRestrictedFromBalanceCorrection } from "@/lib/account-types";
import { useInvestmentHoldingSummary } from "@/shared/investments/use-investment-holding-summary";

export function AccountBalanceCorrectionDialog({
  account,
  open,
  onOpenChange,
}: {
  account: AccountWithBalance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { onSubmit, isPending } = useBalanceCorrectionForm(account, onOpenChange);
  const isRestricted = isAccountTypeRestrictedFromBalanceCorrection(account.account_type);
  const isInvestment = account.account_type === "investment";
  const { data: holding } = useInvestmentHoldingSummary(isInvestment ? account.id : undefined);

  const defaultValues = isInvestment
    ? {
        mode: "investment" as const,
        unit: holding?.remainingUnit ?? 0,
        pricePerUnit: holding?.averageCostPerUnit ?? 0,
      }
    : { mode: "balance" as const, targetBalance: account.balance, countAsCash: true };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Koreksi Saldo</DialogTitle>
        </DialogHeader>
        {isRestricted ? (
          <p className="text-muted-foreground text-sm">
            {account.account_type === "third_party"
              ? `Saldo akun Dana Pihak Ketiga tidak bisa dikoreksi langsung di sini -- saldo akun ini mengikuti riwayat titip/ambil yang tersimpan. Perbaiki lewat tab Data di halaman Dana Pihak Ketiga.`
              : "Saldo akun bertipe Utang Piutang tidak bisa dikoreksi langsung di sini -- saldo akun ini mengikuti riwayat piutang/utang yang tersimpan. Perbaiki lewat transaksi transfer atau betulkan transaksi akar penyebabnya."}
          </p>
        ) : isInvestment && !holding ? (
          <p className="text-muted-foreground text-sm">Memuat data investasi...</p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              {isInvestment
                ? `Masukkan unit dan harga/cost per unit yang seharusnya dimiliki ${account.name} saat ini -- sistem akan membuat transaksi penyesuaian otomatis sebesar selisihnya.`
                : `Saldo berjalan ${account.name} saat ini dianggap tidak sesuai kenyataan. Masukkan saldo yang seharusnya — sistem akan membuat transaksi penyesuaian otomatis sebesar selisihnya.`}
            </p>
            <AccountBalanceCorrectionForm
              accountId={account.id}
              accountType={account.account_type}
              defaultValues={defaultValues}
              onSubmit={onSubmit}
              isPending={isPending}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
