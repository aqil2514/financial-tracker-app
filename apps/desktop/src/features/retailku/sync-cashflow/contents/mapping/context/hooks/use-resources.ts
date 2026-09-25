import { useAccounts, useCategories } from "@/hooks/resources";
import { UseResourcesOutput } from "../interfaces/use-resources";

export function useResources(): UseResourcesOutput {
  const { data: localAccounts } = useAccounts();
  const { data: categories } = useCategories();

  return {
    localAccountOptions: (localAccounts ?? []).filter(
      (account) => account.is_active && account.account_type === "cash",
    ),
    categoryOptions: categories ?? [],
  };
}
