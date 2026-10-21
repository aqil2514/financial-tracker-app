import type { Env } from "../../shared/env";
import { getAccountType, detachDebtForDeletedTransaction } from "../debts/service";
import { detachInvestmentPurchaseForDeletedTransaction, detachInvestmentSaleForDeletedTransaction } from "../investments/service";
import { detachThirdPartyFundsForDeletedTransaction } from "../third-party-funds/service";

type ExistingAccountFields = { account_id: string | null; transfer_account_id: string | null };
type NewAccountFields = { accountId: string; transferAccountId: string | null };

/**
 * Bersihkan baris debts/investment_purchases/investment_sales yatim saat edit transaksi (MCP) memindahkan akun ke domain lain.
 * @param env Worker env (D1 binding)
 * @param transactionId id transaksi yang sedang diedit
 * @param existing akun lama (sebelum diedit)
 * @param next akun baru (dari payload)
 * @returns void — efek sampingnya langsung ke D1 (soft-delete)
 */
export async function cleanupStaleDomainOnAccountChange(
  env: Env,
  transactionId: string,
  existing: ExistingAccountFields,
  next: NewAccountFields
) {
  const accountChanged =
    next.accountId !== existing.account_id || next.transferAccountId !== existing.transfer_account_id;

  if (!accountChanged) return;

  const oldAccountIds = [existing.account_id, existing.transfer_account_id].filter(
    (id): id is string => id != null
  );
  const newAccountIds = [next.accountId, next.transferAccountId].filter((id): id is string => id != null);

  const [oldTypes, newTypes] = await Promise.all([
    Promise.all(oldAccountIds.map((id) => getAccountType(env, id))),
    Promise.all(newAccountIds.map((id) => getAccountType(env, id))),
  ]);

  const oldInvolvesDebt = oldTypes.includes("debt");
  const newInvolvesDebt = newTypes.includes("debt");
  const oldInvolvesInvestment = oldTypes.includes("investment");
  const newInvolvesInvestment = newTypes.includes("investment");
  const oldInvolvesThirdParty = oldTypes.includes("third_party");
  const newInvolvesThirdParty = newTypes.includes("third_party");

  if (oldInvolvesDebt && !newInvolvesDebt) {
    await detachDebtForDeletedTransaction(env, transactionId);
  }

  if (oldInvolvesInvestment && !newInvolvesInvestment) {
    await detachInvestmentPurchaseForDeletedTransaction(env, transactionId);
    await detachInvestmentSaleForDeletedTransaction(env, transactionId);
  }

  if (oldInvolvesThirdParty && !newInvolvesThirdParty) {
    await detachThirdPartyFundsForDeletedTransaction(env, transactionId);
  }
}
