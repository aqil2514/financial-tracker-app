"use client";

import { useMemo } from "react";
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";

import type { Category } from "@/lib/db";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { QueryState } from "@/components/query-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCategories } from "@/hooks/resources/use-categories";
import { CategoryCard } from "./category-card";
import { CategoryEditDialog } from "../form/category-edit-dialog";
import { DeleteCategoryDialog } from "./delete-category-dialog";
import { CategoryStatusDot } from "./category-status-dot";

const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: "Semua Status",
  active: "Aktif",
  inactive: "Nonaktif",
};

type TypeFilter = "all" | "income" | "expense";
type StatusFilter = "all" | "active" | "inactive";

interface CategoryGroup {
  parent: Category;
  children: Category[];
}

export function CategoryList() {
  const { data: categories, isLoading, error } = useCategories();
  const [search, setSearch] = useQueryState("search", parseAsString.withDefault(""));
  const [typeFilter, setTypeFilter] = useQueryState(
    "type",
    parseAsStringEnum<TypeFilter>(["all", "income", "expense"]).withDefault("all")
  );
  const [statusFilter, setStatusFilter] = useQueryState(
    "status",
    parseAsStringEnum<StatusFilter>(["all", "active", "inactive"]).withDefault("all")
  );

  const filtered = useMemo(() => {
    return categories?.filter((category) => {
      if (typeFilter !== "all" && category.type !== typeFilter) return false;
      if (statusFilter === "active" && !category.is_active) return false;
      if (statusFilter === "inactive" && category.is_active) return false;
      if (search && !category.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [categories, search, typeFilter, statusFilter]);

  // Kategori TANPA parent_id jadi "akar": kalau punya anak di hasil
  // filter, akarnya jadi header accordion (bukan card, lihat
  // CategoryCard tidak dipakai untuk parent); kalau tidak punya anak
  // sama sekali (kategori flat), akarnya langsung jadi card biasa di
  // grid terpisah — accordion kosong (klik expand tanpa isi) dihindari.
  const { groupedParents, standaloneCategories } = useMemo(() => {
    const list = filtered ?? [];
    const byId = new Map(list.map((c) => [c.id, c]));

    const childrenByParent = new Map<string, Category[]>();
    for (const category of list) {
      if (category.parent_id == null) continue;
      // Induknya sendiri mungkin sudah tersingkir filter (mis. search
      // cuma cocok di sub-kategori) -- tetap kelompokkan ke parent_id
      // walau parent-nya tidak lolos filter, SELAMA parent itu ada di
      // data asli (categories), bukan cuma di hasil filter.
      const group = childrenByParent.get(category.parent_id) ?? [];
      group.push(category);
      childrenByParent.set(category.parent_id, group);
    }

    const groups: CategoryGroup[] = [];
    const standalone: Category[] = [];

    for (const category of list) {
      if (category.parent_id != null) continue; // ditangani lewat childrenByParent di atas
      const children = childrenByParent.get(category.id) ?? [];
      if (children.length > 0) {
        groups.push({ parent: category, children });
      } else {
        standalone.push(category);
      }
    }

    // Parent yang sendirinya tersingkir filter (mis. search match cuma
    // di anak) tapi anaknya ada di hasil -- tetap tampilkan grupnya,
    // ambil data parent dari `categories` asli (bukan hasil filter).
    for (const [parentId, children] of childrenByParent) {
      if (groups.some((g) => g.parent.id === parentId)) continue;
      if (list.some((c) => c.id === parentId)) continue; // sudah ditangani di loop atas
      const parent = byId.get(parentId) ?? categories?.find((c) => c.id === parentId);
      if (parent) groups.push({ parent, children });
    }

    return { groupedParents: groups, standaloneCategories: standalone };
  }, [filtered, categories]);

  const isEmpty =
    filtered &&
    categories &&
    categories.length > 0 &&
    groupedParents.length === 0 &&
    standaloneCategories.length === 0;

  const groupsKey = groupedParents.map((g) => g.parent.id).join(",");

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
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Semua Status">
              {(value: string) => STATUS_FILTER_LABEL[value as StatusFilter]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="inactive">Nonaktif</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <QueryState isLoading={isLoading} error={error} />

      {isEmpty && (
        <p className="text-muted-foreground text-sm">
          Tidak ada kategori yang cocok dengan filter.
        </p>
      )}
      {categories && categories.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Belum ada kategori. Tambahkan lewat tombol di atas.
        </p>
      )}

      {(groupedParents.length > 0 || standaloneCategories.length > 0) && (
        <div className="space-y-4">
          {groupedParents.length > 0 && (
            <Accordion
              key={groupsKey}
              multiple
              defaultValue={groupedParents.map((g) => g.parent.id)}
              className="gap-4"
            >
              {groupedParents.map(({ parent, children }) => (
                <AccordionItem
                  key={parent.id}
                  value={parent.id}
                  className="not-last:border-b-0 rounded-lg border bg-muted/30 px-4"
                >
                  <AccordionTrigger className="py-3 text-base font-semibold hover:no-underline">
                    <span className="flex flex-1 items-center gap-2 pr-2">
                      <CategoryStatusDot category={parent} />
                      {parent.name}
                      <Badge variant={parent.type === "income" ? "default" : "secondary"}>
                        {parent.type === "income" ? "Pemasukan" : "Pengeluaran"}
                      </Badge>
                      <span className="text-muted-foreground text-sm font-normal">
                        {children.length} sub-kategori
                      </span>
                    </span>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <CategoryEditDialog category={parent} />
                      <DeleteCategoryDialog category={parent} />
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {children.map((child) => (
                        <CategoryCard key={child.id} category={child} parentName={parent.name} />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}

          {standaloneCategories.length > 0 && (
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {standaloneCategories.map((category) => (
                <CategoryCard key={category.id} category={category} parentName={null} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
