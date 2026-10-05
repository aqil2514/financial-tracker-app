import type { AccountWithBalance } from "@/features/accounts";
import type { Category } from "@/lib/db";
import { accountName, accountNameParts } from "../../../../shared/utils/account-name";
import { categoryName } from "../../../../shared/utils/category-name";
import type { ListContextLookup } from "../interface";

export function useListLookup(
  accounts: AccountWithBalance[] | undefined,
  categories: Category[] | undefined
): ListContextLookup {
  return {
    accountName: (id) => accountName(accounts, id),
    accountNameParts: (id) => accountNameParts(accounts, id),
    categoryName: (id) => categoryName(categories, id),
  };
}
