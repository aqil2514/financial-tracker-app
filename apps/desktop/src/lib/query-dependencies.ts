import type { QueryKey } from "@tanstack/react-query";

import { accountsQueryKey, accountGroupsQueryKey } from "@/hooks/resources";
import { categoriesQueryKey } from "@/hooks/resources";
import { contactsQueryKey } from "@/shared/contacts/use-contacts";
import { ongoingDebtsQueryKey } from "@/shared/debts/use-ongoing-debts";
import { debtsListQueryKey } from "@/shared/debts/use-debts-list";
import { contactSummaryQueryKey } from "@/shared/debts/use-contact-summary";
import { transactionsQueryKey } from "@/features/transactions/content/list/use-transactions";
import { recentTransactionsQueryKey } from "@/features/dashboard/content/recent-transactions/use-recent-transactions";
import { currentMonthSummaryQueryKey } from "@/features/dashboard/content/current-month-summary/use-current-month-summary";
import { monthlySummaryQueryKey } from "@/features/reports/use-monthly-summary";
import { categoryBreakdownQueryKey } from "@/features/reports/use-category-breakdown";
import { accountBalancesQueryKey } from "@/features/reports/use-account-balances";
import { accountGroupBalancesQueryKey } from "@/features/accounts/sections/balance-pie-chart/use-account-group-balances";
import { transactionDaysQueryKey } from "@/features/transactions/content/calendar/use-transaction-days";
import { monthSummaryQueryKey } from "@/features/transactions/content/calendar/use-month-summary";

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
    categoryBreakdownQueryKey,
    accountBalancesQueryKey,
    accountGroupBalancesQueryKey,
    transactionDaysQueryKey,
    monthSummaryQueryKey,
    ongoingDebtsQueryKey, // transaksi transfer bisa membuat/melunasi debts
    debtsListQueryKey,
    contactSummaryQueryKey,
  ],
  accounts: [accountsQueryKey, accountBalancesQueryKey, accountGroupBalancesQueryKey],
  accountGroups: [accountGroupsQueryKey, accountGroupBalancesQueryKey],
  categories: [categoriesQueryKey],
  contacts: [contactsQueryKey],
  debts: [ongoingDebtsQueryKey, debtsListQueryKey, contactSummaryQueryKey],
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
