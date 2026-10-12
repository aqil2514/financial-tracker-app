import type { Env } from "../../../shared/env";
import { nowText } from "../../../shared/lww";
import { fetchAccountGroups, type AccountGroupRow } from "./entities/account-groups";
import { fetchCategories, type CategoryRow } from "./entities/categories";
import { fetchContacts, type ContactRow } from "./entities/contacts";
import { fetchAccounts, type AccountRow } from "./entities/accounts";
import { fetchTransactions, type TransactionRow } from "./entities/transactions";
import { fetchDebts, type DebtRow } from "./entities/debts";
import { fetchDebtPayments, type DebtPaymentRow } from "./entities/debt-payments";
import { fetchInvestmentAccounts, type InvestmentAccountRow } from "./entities/investment-accounts";
import { fetchInvestmentPurchases, type InvestmentPurchaseRow } from "./entities/investment-purchases";
import { fetchInvestmentSales, type InvestmentSaleRow } from "./entities/investment-sales";
import { fetchLabels, type LabelRow } from "./entities/labels";
import { fetchTransactionLabels, type TransactionLabelRow } from "./entities/transaction-labels";
import { fetchCategoryLabels, type CategoryLabelRow } from "./entities/category-labels";
import { fetchAccountLabels, type AccountLabelRow } from "./entities/account-labels";
import { fetchCategoryPeriods, type CategoryPeriodRow } from "./entities/category-periods";

export type SyncResponse = {
  checkpoint: string;
  accountGroups: AccountGroupRow[];
  categories: CategoryRow[];
  contacts: ContactRow[];
  accounts: AccountRow[];
  transactions: TransactionRow[];
  debts: DebtRow[];
  debtPayments: DebtPaymentRow[];
  investmentAccounts: InvestmentAccountRow[];
  investmentPurchases: InvestmentPurchaseRow[];
  investmentSales: InvestmentSaleRow[];
  labels: LabelRow[];
  transactionLabels: TransactionLabelRow[];
  categoryLabels: CategoryLabelRow[];
  accountLabels: AccountLabelRow[];
  categoryPeriods: CategoryPeriodRow[];
};

export async function getSyncSnapshot(env: Env, since: string | null): Promise<SyncResponse> {
  const checkpoint = nowText();
  const filter = since !== null ? "WHERE updated_at > ?1" : "";
  const bind = since !== null ? [since] : [];

  const [
    accountGroups,
    categories,
    contacts,
    accounts,
    transactions,
    debts,
    debtPayments,
    investmentAccounts,
    investmentPurchases,
    investmentSales,
    labels,
    transactionLabels,
    categoryLabels,
    accountLabels,
    categoryPeriods,
  ] = await Promise.all([
    fetchAccountGroups(env, filter, bind),
    fetchCategories(env, filter, bind),
    fetchContacts(env, filter, bind),
    fetchAccounts(env, filter, bind),
    fetchTransactions(env, filter, bind),
    fetchDebts(env, filter, bind),
    fetchDebtPayments(env, filter, bind),
    fetchInvestmentAccounts(env, filter, bind),
    fetchInvestmentPurchases(env, filter, bind),
    fetchInvestmentSales(env, filter, bind),
    fetchLabels(env, filter, bind),
    fetchTransactionLabels(env, filter, bind),
    fetchCategoryLabels(env, filter, bind),
    fetchAccountLabels(env, filter, bind),
    fetchCategoryPeriods(env, since),
  ]);

  return {
    checkpoint,
    accountGroups,
    categories,
    contacts,
    accounts,
    transactions,
    debts,
    debtPayments,
    investmentAccounts,
    investmentPurchases,
    investmentSales,
    labels,
    transactionLabels,
    categoryLabels,
    accountLabels,
    categoryPeriods,
  };
}
