import { useQuery } from "@tanstack/react-query";
import { getDb, type Contact } from "@/lib/db";

export const contactsQueryKey = ["contacts"];

export function useContacts() {
  return useQuery({
    queryKey: contactsQueryKey,
    queryFn: async () => {
      const db = await getDb();
      return db.select<Contact[]>("SELECT * FROM contacts ORDER BY name COLLATE NOCASE");
    },
  });
}
