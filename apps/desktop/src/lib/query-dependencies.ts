import type { QueryKey } from "@tanstack/react-query";

import { accountsQueryKey, accountGroupsQueryKey } from "@/hooks/resources";
import { categoriesQueryKey } from "@/hooks/resources";
import { contactsQueryKey } from "@/shared/contacts/use-contacts";
import { ongoingDebtsQueryKey } from "@/shared/debts/use-ongoing-debts";
import { debtsListQueryKey } from "@/shared/debts/use-debts-list";
import { debtPaymentsQueryKey } from "@/shared/debts/use-debt-payments";
import { contactSummaryQueryKey } from "@/shared/debts/use-contact-summary";
import { transactionsQueryKey } from "@/features/transactions/content/list/use-transactions";
import { recentTransactionsQueryKey } from "@/features/dashboard/content/recent-transactions/use-recent-transactions";
import { currentMonthSummaryQueryKey } from "@/features/dashboard/content/current-month-summary/use-current-month-summary";
import { monthlySummaryQueryKey } from "@/features/reports/use-monthly-summary";
import { accountBalancesQueryKey } from "@/features/reports/use-account-balances";
import { cashflowBreakdownQueryKey } from "@/features/reports/content/cashflow/use-cashflow-breakdown";
import { cashflowSummaryQueryKey } from "@/features/reports/content/cashflow/use-cashflow-summary";
import { balancesByAccountTypeQueryKey } from "@/features/reports/content/account-type/use-balances-by-account-type";
import { balanceTrendQueryKey } from "@/features/reports/content/balance-trend/use-balance-trend";
import { accountGroupBalancesQueryKey } from "@/features/accounts/sections/balance-pie-chart/use-account-group-balances";
import { transactionDaysQueryKey } from "@/features/transactions/shared/hooks/use-transaction-days";
import { monthSummaryQueryKey } from "@/features/transactions/shared/hooks/use-month-summary";
import { accountSummaryQueryKey } from "@/features/account-detail/header/use-account-summary";
import { investmentAccountQueryKey } from "@/shared/investments/use-investment-account";
import { transactionInvestmentPurchaseQueryKey } from "@/shared/investments/use-transaction-investment-purchase";
import { investmentPurchasesQueryKey } from "@/shared/investments/use-investment-purchases";

// Peta ketergantungan query key lintas fitur: kalau data sebuah DOMAIN
// berubah (mis. transaksi ditambah/diedit/dihapus), semua query key di
// sini ikut di-invalidate — termasuk query turunan (dashboard, reports,
// calendar) yang sebelumnya gampang lupa didaftarkan manual satu-satu di
// tiap mutation.
//
// Tambah query baru yang bergantung pada domain ini? Cukup tambahkan
// query key-nya ke array domain terkait di bawah — TIDAK perlu menyentuh
// file mutation manapun.
export const QUERY_DEPENDENCIES = {
  transactions: [
    transactionsQueryKey,
    accountsQueryKey, // saldo akun berubah setiap transaksi berubah
    recentTransactionsQueryKey,
    currentMonthSummaryQueryKey,
    monthlySummaryQueryKey,
    cashflowBreakdownQueryKey,
    cashflowSummaryQueryKey,
    accountBalancesQueryKey,
    balancesByAccountTypeQueryKey,
    balanceTrendQueryKey,
    accountGroupBalancesQueryKey,
    transactionDaysQueryKey,
    monthSummaryQueryKey,
    accountSummaryQueryKey,
    ongoingDebtsQueryKey, // transaksi transfer bisa membuat/melunasi debts
    debtsListQueryKey,
    debtPaymentsQueryKey,
    contactSummaryQueryKey,
    transactionInvestmentPurchaseQueryKey, // transfer cash->investment bisa membuat/edit investment_purchases
    investmentPurchasesQueryKey, // riwayat lot per akun (features/investment-detail/content/) ikut berubah
  ],
  accounts: [
    accountsQueryKey,
    accountBalancesQueryKey,
    balancesByAccountTypeQueryKey,
    balanceTrendQueryKey,
    accountGroupBalancesQueryKey,
    investmentAccountQueryKey, // edit akun investasi bisa menulis investment_accounts
  ],
  accountGroups: [accountGroupsQueryKey, accountGroupBalancesQueryKey, balanceTrendQueryKey],
  categories: [categoriesQueryKey],
  contacts: [contactsQueryKey],
  debts: [ongoingDebtsQueryKey, debtsListQueryKey, debtPaymentsQueryKey, contactSummaryQueryKey],
} satisfies Record<string, QueryKey[]>;

export type QueryDependencyDomain = keyof typeof QUERY_DEPENDENCIES;

// Gabungan beberapa domain sekaligus, tanpa duplikat query key yang sama
// (mis. accountsQueryKey muncul di domain transactions DAN accounts) —
// dipakai oleh data-import yang mempengaruhi banyak domain sekaligus.
export function dependentKeysOf(...domains: QueryDependencyDomain[]): QueryKey[] {
  const seen = new Set<string>();
  const result: QueryKey[] = [];

  for (const domain of domains) {
    for (const key of QUERY_DEPENDENCIES[domain]) {
      const serialized = JSON.stringify(key);
      if (!seen.has(serialized)) {
        seen.add(serialized);
        result.push(key);
      }
    }
  }

  return result;
}
