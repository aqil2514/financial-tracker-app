"use client";

import { Card } from "@/components/ui/card";
import { AccountsProvider } from "./accounts-context";
import { AccountsCardHeader } from "./header";
import { AccountListContent } from "./content";
import { AccountsCardFooter } from "./footer";

export function AccountList() {
  return (
    <AccountsProvider>
      <Card>
        <AccountsCardHeader />
        <AccountListContent />
        <AccountsCardFooter />
      </Card>
    </AccountsProvider>
  );
}

export {
  useAccounts,
  accountsQueryKey,
  type AccountWithBalance,
} from "@/hooks/resources/use-accounts";
export { useDeleteAccount } from "./use-delete-account";
