"use client";

import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { useEntityForm } from "@/hooks/use-entity-form";
import { isEmptyDoc } from "@/components/rich-text";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { contactSchema, type ContactFormOutput } from "./contact.schema";

export function useCreateContact() {
  return useEntityForm({
    schema: contactSchema,
    defaultValues: () => ({
      name: "",
      note: null,
    }),
    mutationFn: async (values: ContactFormOutput) => {
      const db = await getDb();
      await db.execute("INSERT INTO contacts (id, name, note) VALUES ($1, $2, $3)", [
        newId(),
        values.name,
        isEmptyDoc(values.note) ? null : JSON.stringify(values.note),
      ]);
    },
    invalidateKey: QUERY_DEPENDENCIES.contacts,
    successMessage: "Kontak berhasil ditambahkan",
    errorMessage: "Gagal menambahkan kontak",
  });
}
