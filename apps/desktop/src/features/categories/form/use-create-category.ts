"use client";

import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { useEntityForm } from "@/hooks/use-entity-form";
import { categorySchema, type CategoryFormOutput } from "./category.schema";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";

type UseCreateCategoryOptions = {
  /** Prefill nama (mis. dari query combobox saat "buat baru" dipicu dari
   * form lain) dan tipe kategori (mis. disamakan dengan tipe transaksi
   * yang sedang diisi). */
  initialValues?: { name?: string; type?: CategoryFormOutput["type"] };
  /** Dipanggil dengan id kategori yang baru dibuat — dipakai caller
   * (mis. combobox kategori di form transaksi) untuk langsung memilih
   * kategori baru itu tanpa user perlu cari ulang. */
  onCreated?: (id: string) => void;
};

export function useCreateCategory(options: UseCreateCategoryOptions = {}) {
  const { initialValues, onCreated } = options;

  return useEntityForm({
    schema: categorySchema,
    defaultValues: () => ({
      name: initialValues?.name ?? "",
      type: initialValues?.type ?? ("expense" as const),
      parent_id: null,
      is_active: "1" as const,
    }),
    resetOnOpen: true,
    mutationFn: async (values: CategoryFormOutput) => {
      const db = await getDb();
      const id = newId();
      await db.execute(
        "INSERT INTO categories (id, name, type, parent_id, is_active) VALUES ($1, $2, $3, $4, $5)",
        [
          id,
          values.name,
          values.type,
          values.parent_id ? values.parent_id : null,
          Number(values.is_active),
        ]
      );
      void pushOnWrite("categories", id);
      return id;
    },
    invalidateKey: QUERY_DEPENDENCIES.categories,
    successMessage: "Kategori berhasil ditambahkan",
    errorMessage: "Gagal menambahkan kategori",
    onSuccess: (id) => {
      onCreated?.(id);
    },
  });
}
