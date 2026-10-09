"use client";

import { useEffect } from "react";
import { getDb, type Category } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { categorySchema, type CategoryFormOutput } from "./category.schema";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { resolveLabelIds } from "@/shared/labels/resolve-label-ids";
import { applyCategoryLabels } from "@/shared/labels/apply-category-labels";
import { useCategoryLabels } from "@/shared/labels/use-category-labels";

export function useUpdateCategory(category: Category) {
  const { data: currentLabelNames } = useCategoryLabels(category.id);

  const entityForm = useEntityForm({
    schema: categorySchema,
    defaultValues: () => ({
      name: category.name,
      type: category.type,
      parent_id: category.parent_id != null ? String(category.parent_id) : null,
      is_active: String(category.is_active) as "1" | "0",
      label_names: currentLabelNames ?? [],
    }),
    resetOnOpen: true,
    mutationFn: async (values: CategoryFormOutput) => {
      const db = await getDb();
      await db.execute(
        "UPDATE categories SET name = $1, type = $2, parent_id = $3, is_active = $4 WHERE id = $5",
        [
          values.name,
          values.type,
          values.parent_id ? values.parent_id : null,
          Number(values.is_active),
          category.id,
        ]
      );
      void pushOnWrite("categories", category.id);

      const labelIds = await resolveLabelIds(values.label_names, "transaction_category");
      await applyCategoryLabels(category.id, labelIds);
    },
    invalidateKey: QUERY_DEPENDENCIES.categories,
    successMessage: "Kategori berhasil diperbarui",
    errorMessage: "Gagal memperbarui kategori",
  });

  // Race condition sama persis use-update-transaction.ts -- useCategoryLabels
  // baru mulai fetch saat dialog edit ini pertama terbuka, defaultValues()
  // bisa terpanggil sebelum data itu sampai. Re-sync manual begitu data
  // datang, TANPA mengubah useEntityForm generik.
  useEffect(() => {
    if (entityForm.open && currentLabelNames !== undefined) {
      entityForm.form.setValue("label_names", currentLabelNames, { shouldDirty: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityForm.open, currentLabelNames]);

  return entityForm;
}
