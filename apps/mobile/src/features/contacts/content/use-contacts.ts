import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useDatabase } from "@/lib/database";
import { ContactListItem } from "../types";

interface ContactRow {
  id: string;
  name: string;
  note: string | null;
}

function toListItem(row: ContactRow): ContactListItem {
  return {
    id: row.id,
    name: row.name,
    note: row.note,
  };
}

export function useContacts() {
  const db = useDatabase();
  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await db.getAllAsync<ContactRow>(
        `SELECT id, name, note FROM contacts ORDER BY name ASC`
      );
      setContacts(rows.map(toListItem));
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  return { contacts, isLoading, refetch };
}
