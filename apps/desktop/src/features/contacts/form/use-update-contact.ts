"use client";

import { getDb, type Contact } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { isEmptyDoc } from "@/components/rich-text";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { contactSchema, type ContactFormOutput } from "./contact.schema";

export function useUpdateContact(contact: Contact) {
  return useEntityForm({
    schema: contactSchema,
    defaultValues: () => ({
      name: contact.name,
      note: contact.note ? JSON.parse(contact.note) : null,
    }),
    resetOnOpen: true,
    mutationFn: async (values: ContactFormOutput) => {
      const db = await getDb();
      await db.execute("UPDATE contacts SET name = $1, note = $2 WHERE id = $3", [
        values.name,
        isEmptyDoc(values.note) ? null : JSON.stringify(values.note),
        contact.id,
      ]);
    },
    invalidateKey: QUERY_DEPENDENCIES.contacts,
    successMessage: "Kontak berhasil diperbarui",
    errorMessage: "Gagal memperbarui kontak",
  });
}
