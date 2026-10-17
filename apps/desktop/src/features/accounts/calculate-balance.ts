import type { Account } from "@/lib/db";

export type AccountWithBalance = Account & {
  balance: number;
  group_name: string | null;
  debt_direction: "receivable" | "payable" | null;
};
