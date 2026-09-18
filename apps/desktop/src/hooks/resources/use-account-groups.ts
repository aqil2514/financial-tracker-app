import { useQuery } from "@tanstack/react-query";
import { getDb, type AccountGroup } from "@/lib/db";

export const accountGroupsQueryKey = ["account-groups"];

export function useAccountGroups() {
  return useQuery({
    queryKey: accountGroupsQueryKey,
    queryFn: async () => {
      const db = await getDb();
      return db.select<AccountGroup[]>(
        "SELECT * FROM account_groups ORDER BY name COLLATE NOCASE"
      );
    },
  });
}
