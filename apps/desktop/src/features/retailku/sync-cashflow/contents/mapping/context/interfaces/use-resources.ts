// apps\desktop\src\features\retailku\sync-cashflow\contents\mapping\context\hooks\use-resources.ts

import { AccountWithBalance } from "@/hooks/resources";
import { Category } from "@/lib/db";

export interface UseResourcesOutput {
  localAccountOptions: AccountWithBalance[]
  categoryOptions: Category[];
}
