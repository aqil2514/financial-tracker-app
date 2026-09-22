import type { AccountWithBalance } from "@/features/accounts";
import type { Category } from "@/lib/db";
import { accountName } from "../../../../shared/utils/account-name";
import { categoryName } from "../../../../shared/utils/category-name";
import type { ListContextLookup } from "../interface";

export function useListLookup(
  accounts: AccountWithBalance[] | undefined,
  categories: Category[] | undefined
): ListContextLookup {
  return {
    accountName: (id) => accountName(accounts, id),
    categoryName: (id) => categoryName(categories, id),
  };
}
