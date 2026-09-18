"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import type { Category } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCategories } from "@/hooks/resources/use-categories";
import { getDb } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";
import { useDeleteCategory } from "./use-delete-category";

type RelationAction = "unassign" | "reassign";

function useTransactionCountByCategory(categoryId: number) {
  return useQuery({
    queryKey: ["categories", "transaction-count", categoryId],
    queryFn: async () => {
      const db = await getDb();
      const [{ count }] = await db.select<{ count: number }[]>(
        "SELECT COUNT(*) as count FROM transactions WHERE category_id = $1",
        [categoryId]
      );
      return count;
    },
  });
}

export function DeleteCategoryDialog({ category }: { category: Category }) {
  const [open, setOpen] = useState(false);
  const [childAction, setChildAction] = useState<RelationAction>("unassign");
  const [targetParentId, setTargetParentId] = useState<string | null>(null);
  const [transactionAction, setTransactionAction] = useState<RelationAction>("unassign");
  const [targetCategoryId, setTargetCategoryId] = useState<string | null>(null);

  const { data: categories } = useCategories();
  const { data: transactionCount } = useTransactionCountByCategory(category.id);
  const deleteCategory = useDeleteCategory();

  useEffect(() => {
    if (open) {
      setChildAction("unassign");
      setTargetParentId(null);
      setTransactionAction("unassign");
      setTargetCategoryId(null);
    }
  }, [open]);

  const children = useMemo(
    () => (categories ?? []).filter((c) => c.parent_id === category.id),
    [categories, category.id]
  );
  const otherCategoriesSameType = useMemo(
    () =>
      (categories ?? []).filter(
        (c) => c.id !== category.id && c.type === category.type
      ),
    [categories, category.id, category.type]
  );

  const hasChildren = children.length > 0;
  const hasTransactions = (transactionCount ?? 0) > 0;
  const hasAnyRelation = hasChildren || hasTransactions;

  const isTargetParentValid =
    targetParentId != null &&
    otherCategoriesSameType.some((c) => String(c.id) === targetParentId);
  const isTargetCategoryValid =
    targetCategoryId != null &&
    otherCategoriesSameType.some((c) => String(c.id) === targetCategoryId);

  function handleConfirm() {
    deleteCategory.mutate(
      {
        id: category.id,
        childAction: hasChildren ? childAction : undefined,
        targetParentId:
          hasChildren && childAction === "reassign" && isTargetParentValid
            ? Number(targetParentId)
            : undefined,
        transactionAction: hasTransactions ? transactionAction : undefined,
        targetCategoryId:
          hasTransactions && transactionAction === "reassign" && isTargetCategoryValid
            ? Number(targetCategoryId)
            : undefined,
      },
      { onSuccess: () => setOpen(false) }
    );
  }

  const canConfirm =
    (!hasChildren || childAction === "unassign" || (childAction === "reassign" && isTargetParentValid)) &&
    (!hasTransactions ||
      transactionAction === "unassign" ||
      (transactionAction === "reassign" && isTargetCategoryValid));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Trash2 className="text-destructive size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hapus kategori &quot;{category.name}&quot;?</DialogTitle>
          <DialogDescription>
            {hasAnyRelation
              ? "Kategori ini masih terpakai. Pilih apa yang terjadi pada data terkait."
              : "Tindakan ini tidak bisa dibatalkan."}
          </DialogDescription>
        </DialogHeader>

        {hasChildren && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {children.length} sub-kategori
            </p>
            <ToggleGroup
              value={[childAction]}
              onValueChange={(values: string[]) => {
                if (values.length > 0) {
                  setChildAction(values[values.length - 1] as RelationAction);
                }
              }}
              className="w-full"
            >
              <ToggleGroupItem value="unassign" className="flex-1">
                Jadikan mandiri
              </ToggleGroupItem>
              <ToggleGroupItem
                value="reassign"
                className="flex-1"
                disabled={otherCategoriesSameType.length === 0}
              >
                Pindahkan ke induk lain
              </ToggleGroupItem>
            </ToggleGroup>
            {childAction === "reassign" && (
              <Select value={targetParentId ?? ""} onValueChange={setTargetParentId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih kategori induk tujuan...">
                    {(value: string | null) =>
                      otherCategoriesSameType.find((c) => String(c.id) === value)?.name ??
                      "Pilih kategori induk tujuan..."
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {otherCategoriesSameType.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {hasTransactions && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{transactionCount} transaksi</p>
            <ToggleGroup
              value={[transactionAction]}
              onValueChange={(values: string[]) => {
                if (values.length > 0) {
                  setTransactionAction(values[values.length - 1] as RelationAction);
                }
              }}
              className="w-full"
            >
              <ToggleGroupItem value="unassign" className="flex-1">
                Lepas ke Tanpa Kategori
              </ToggleGroupItem>
              <ToggleGroupItem
                value="reassign"
                className="flex-1"
                disabled={otherCategoriesSameType.length === 0}
              >
                Pindahkan ke kategori lain
              </ToggleGroupItem>
            </ToggleGroup>
            {transactionAction === "reassign" && (
              <Select value={targetCategoryId ?? ""} onValueChange={setTargetCategoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih kategori tujuan...">
                    {(value: string | null) =>
                      otherCategoriesSameType.find((c) => String(c.id) === value)?.name ??
                      "Pilih kategori tujuan..."
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {otherCategoriesSameType.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={deleteCategory.isPending}
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm || deleteCategory.isPending}
          >
            {deleteCategory.isPending ? "Menghapus..." : "Hapus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
