"use client";

import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";
import { isAccountInUse } from "./is-account-in-use";

/** Lihat is-account-in-use.ts untuk definisi "dipakai". */
export function useAccountIsUsed(accountId: string | undefined) {
  return useQuery({
    queryKey: ["accounts", "is-used", accountId],
    enabled: accountId != null,
    queryFn: async (): Promise<boolean> => {
      const db = await getDb();
      return isAccountInUse(db, accountId as string);
    },
  });
}
