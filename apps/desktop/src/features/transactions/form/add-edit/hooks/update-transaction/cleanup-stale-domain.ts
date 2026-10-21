import { getDb, type Transaction } from "@/lib/db";
import { getAccountType } from "@/lib/db/helper";
import { detachDebtForDeletedTransaction } from "@/shared/debts/apply-debt-transaction";
import { detachInvestmentPurchaseForDeletedTransaction } from "@/shared/investments/apply-investment-transaction";
import { detachInvestmentSaleForDeletedTransaction } from "@/shared/investments/apply-sell-investment-transaction";
import { detachThirdPartyFundsForDeletedTransaction } from "@/shared/third-party-funds";
import { pushOnWrite, pushDeleteOnWrite } from "@/shared/cloud-sync/push-on-write";
import type { TransactionFormOutput } from "../../schema";

type Db = Awaited<ReturnType<typeof getDb>>;

/**
 * Bersihkan baris debts/investment_purchases/investment_sales yatim saat edit transaksi memindahkan akun ke domain lain.
 * @param db koneksi database aktif
 * @param transaction transaksi versi lama (sebelum diedit)
 * @param values nilai form versi baru
 * @returns void — efek sampingnya langsung ke DB + cloud sync push
 */
export async function cleanupStaleDomainOnAccountChange(db: Db, transaction: Transaction, values: TransactionFormOutput) {
  const newTransferAccountId = values.type === "transfer" ? values.transfer_account_id : null;
  const accountChanged =
    values.account_id !== transaction.account_id ||
    newTransferAccountId !== transaction.transfer_account_id;

  if (!accountChanged) return;

  const oldAccountIds = [transaction.account_id, transaction.transfer_account_id].filter(
    (id): id is string => id != null
  );
  const newAccountIds = [values.account_id, newTransferAccountId].filter((id): id is string => id != null);

  const [oldTypes, newTypes] = await Promise.all([
    Promise.all(oldAccountIds.map((id) => getAccountType(db, id))),
    Promise.all(newAccountIds.map((id) => getAccountType(db, id))),
  ]);

  const oldInvolvesDebt = oldTypes.includes("debt");
  const newInvolvesDebt = newTypes.includes("debt");
  const oldInvolvesInvestment = oldTypes.includes("investment");
  const newInvolvesInvestment = newTypes.includes("investment");
  const oldInvolvesThirdParty = oldTypes.includes("third_party");
  const newInvolvesThirdParty = newTypes.includes("third_party");

  if (oldInvolvesDebt && !newInvolvesDebt) {
    const debtInfo = await detachDebtForDeletedTransaction(db, transaction.id);
    if (debtInfo.role !== "none") void pushOnWrite("debts", debtInfo.debtId);
  }

  if (oldInvolvesInvestment && !newInvolvesInvestment) {
    const purchaseInfo = await detachInvestmentPurchaseForDeletedTransaction(db, transaction.id);
    if (purchaseInfo.role === "purchase") {
      void pushDeleteOnWrite("investment_purchases", purchaseInfo.investmentPurchaseId, {});
    }

    const saleInfo = await detachInvestmentSaleForDeletedTransaction(db, transaction.id);
    if (saleInfo.role === "sale") {
      void pushDeleteOnWrite("investment_sales", saleInfo.investmentSaleId, {});
      if (saleInfo.adjustmentTransactionId != null) {
        void pushDeleteOnWrite("transactions", saleInfo.adjustmentTransactionId, {});
      }
    }
  }

  // Belum ada jalur UI yang mengizinkan transaksi third_party pindah akun
  // ke tipe lain lewat form transaksi utama saat ini (routing
  // createIncomeTransaction dkk belum tahu third_party, lihat
  // docs/todos/plan/account-type-third-party.md poin 4/5) -- cabang ini
  // defense-in-depth, konsisten dengan debt/investment di atas kalau
  // jalur itu disambung nanti.
  if (oldInvolvesThirdParty && !newInvolvesThirdParty) {
    const thirdPartyInfo = await detachThirdPartyFundsForDeletedTransaction(db, transaction.id);
    for (const fundId of thirdPartyInfo.deletedThirdPartyFundIds) {
      void pushDeleteOnWrite("third_party_funds", fundId, {});
    }
  }
}
