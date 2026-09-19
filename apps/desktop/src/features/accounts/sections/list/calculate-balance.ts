import type { Account } from "@/lib/db";

export type AccountWithBalance = Account & {
  balance: number;
  group_name: string | null;
};
