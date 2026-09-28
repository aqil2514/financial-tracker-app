import { useAccounts, useCategories } from "@/hooks/resources";
import { useContacts } from "@/shared/contacts/use-contacts";
import { UseResourcesOutput } from "../interfaces/use-resources";

export function useResources(): UseResourcesOutput {
  const { data: localAccounts } = useAccounts();
  const { data: categories } = useCategories();
  const { data: contacts } = useContacts();

  return {
    localAccountOptions: (localAccounts ?? []).filter(
      (account) => account.is_active && account.account_type === "cash",
    ),
    debtAccountOptions: (localAccounts ?? []).filter(
      (account) => account.is_active && account.account_type === "debt",
    ),
    categoryOptions: categories ?? [],
    contactOptions: contacts ?? [],
  };
}
