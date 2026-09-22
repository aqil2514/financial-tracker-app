import type { AccountWithBalance } from "@/features/accounts";
import type { Category } from "@/lib/db";
import type { ListContextLookup } from "../interface";

export function useListLookup(
  accounts: AccountWithBalance[] | undefined,
  categories: Category[] | undefined
): ListContextLookup {
  function accountName(id: number | null) {
    return accounts?.find((account) => account.id === id)?.name ?? "-";
  }

  function categoryName(id: number | null) {
    return categories?.find((category) => category.id === id)?.name ?? null;
  }

  return { accountName, categoryName };
}
