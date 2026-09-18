"use client";

import { useMemo, useState } from "react";

import type { Category } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Input } from "@/components/ui/input";
import { QueryState } from "@/components/query-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CategoryEditDialog } from "../form/category-edit-dialog";
import { useCategories } from "@/hooks/resources/use-categories";
import { useDeleteCategory } from "./use-delete-category";

type TypeFilter = "all" | "income" | "expense";

export function CategoryList() {
  const { data: categories, isLoading, error } = useCategories();
  const deleteCategory = useDeleteCategory();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  function parentName(parentId: number | null) {
    return categories?.find((category) => category.id === parentId)?.name ?? null;
  }

  const filtered = useMemo(() => {
    return categories?.filter((category) => {
      if (typeFilter !== "all" && category.type !== typeFilter) return false;
      if (search && !category.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [categories, search, typeFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Cari kategori..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-56"
        />
        <ToggleGroup
          value={[typeFilter]}
          onValueChange={(values: string[]) => {
            if (values.length > 0) {
              setTypeFilter(values[values.length - 1] as TypeFilter);
            }
          }}
        >
          <ToggleGroupItem value="all">Semua</ToggleGroupItem>
          <ToggleGroupItem value="income">Pemasukan</ToggleGroupItem>
          <ToggleGroupItem value="expense">Pengeluaran</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <QueryState isLoading={isLoading} error={error} />
      <ScrollArea className="h-80">
        <div className="space-y-2 pr-4">
          {filtered?.map((category) => (
            <div
              key={category.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{category.name}</p>
                  <Badge variant={category.type === "income" ? "default" : "secondary"}>
                    {category.type === "income" ? "Pemasukan" : "Pengeluaran"}
                  </Badge>
                </div>
                {category.parent_id != null && (
                  <p className="text-muted-foreground text-xs">
                    Sub-kategori dari {parentName(category.parent_id)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <CategoryEditDialog category={category} />
                <ConfirmDeleteButton
                  onConfirm={() => deleteCategory.mutate(category.id)}
                  isPending={deleteCategory.isPending}
                  title={`Hapus kategori "${category.name}"?`}
                  description="Kategori yang masih dipakai transaksi atau punya sub-kategori tidak bisa dihapus."
                />
              </div>
            </div>
          ))}
          {filtered && filtered.length === 0 && categories && categories.length > 0 && (
            <p className="text-muted-foreground text-sm">
              Tidak ada kategori yang cocok dengan filter.
            </p>
          )}
          {categories && categories.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Belum ada kategori. Tambahkan lewat tombol di atas.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
