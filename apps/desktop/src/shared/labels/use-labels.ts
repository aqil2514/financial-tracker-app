import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export type LabelScope = "transaction_category" | "account";

export type Label = {
  id: string;
  name: string;
  scope: LabelScope;
};

export function labelsQueryKey(scope: LabelScope) {
  return ["labels", scope];
}

/** List label aktif (bukan soft-deleted) utk 1 scope -- dipakai combobox
 * multi-select label di form transaksi/kategori/akun. Pola sama
 * `useContacts`, query key per-scope (bukan 1 key utk semua) supaya ganti
 * scope tidak perlu filter ulang di memori. */
export function useLabels(scope: LabelScope) {
  return useQuery({
    queryKey: labelsQueryKey(scope),
    queryFn: async () => {
      const db = await getDb();
      return db.select<Label[]>(
        "SELECT id, name, scope FROM labels WHERE scope = $1 AND deleted_at IS NULL ORDER BY name COLLATE NOCASE",
        [scope]
      );
    },
  });
}
