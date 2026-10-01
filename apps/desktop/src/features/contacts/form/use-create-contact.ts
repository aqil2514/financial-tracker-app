"use client";

import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { useEntityForm } from "@/hooks/use-entity-form";
import { isEmptyDoc } from "@/components/rich-text";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { contactSchema, type ContactFormOutput } from "./contact.schema";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";

export function useCreateContact() {
  return useEntityForm({
    schema: contactSchema,
    defaultValues: () => ({
      name: "",
      note: null,
    }),
    mutationFn: async (values: ContactFormOutput) => {
      const db = await getDb();
      const id = newId();
      await db.execute("INSERT INTO contacts (id, name, note) VALUES ($1, $2, $3)", [
        id,
        values.name,
        isEmptyDoc(values.note) ? null : JSON.stringify(values.note),
      ]);
      void pushOnWrite("contacts", id);
    },
    invalidateKey: QUERY_DEPENDENCIES.contacts,
    successMessage: "Kontak berhasil ditambahkan",
    errorMessage: "Gagal menambahkan kontak",
  });
}
