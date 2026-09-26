import type { AccountWithBalance } from "@/hooks/resources/use-accounts";
import type { RetailkuSettings } from "@/shared/retailku";

export interface UseSyncPrerequisitesOutput {
  cashAccountOptions: AccountWithBalance[];
  debtAccountOptions: AccountWithBalance[];
  retailkuSettings: RetailkuSettings | undefined;
  hasCredentials: boolean;
}
