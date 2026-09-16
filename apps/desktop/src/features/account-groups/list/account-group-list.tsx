"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AccountGroupEditDialog } from "../form/account-group-edit-dialog";
import { useAccountGroups } from "./use-account-groups";
import { useDeleteAccountGroup } from "./use-delete-account-group";

export function AccountGroupList() {
  const { data: groups, isLoading, error } = useAccountGroups();
  const deleteGroup = useDeleteAccountGroup();

  return (
    <div className="space-y-2">
      {isLoading && <p className="text-muted-foreground text-sm">Memuat...</p>}
      {error && (
        <p className="text-destructive text-sm">
          Gagal memuat: {(error as Error).message}
        </p>
      )}
      {groups?.map((group) => (
        <div
          key={group.id}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <p className="text-sm font-medium">{group.name}</p>
          <div className="flex items-center gap-1">
            <AccountGroupEditDialog group={group} />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => deleteGroup.mutate(group.id)}
              disabled={deleteGroup.isPending}
            >
              <Trash2 className="text-destructive size-4" />
            </Button>
          </div>
        </div>
      ))}
      {groups && groups.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Belum ada group. Tambahkan lewat tombol di atas.
        </p>
      )}
    </div>
  );
}
