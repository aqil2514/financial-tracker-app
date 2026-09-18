"use client";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { QueryState } from "@/components/query-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AccountGroupEditDialog } from "../form/account-group-edit-dialog";
import { useAccountGroups } from "@/hooks/resources/use-account-groups";
import { useDeleteAccountGroup } from "./use-delete-account-group";

export function AccountGroupList() {
  const { data: groups, isLoading, error } = useAccountGroups();
  const deleteGroup = useDeleteAccountGroup();

  return (
    <div>
      <QueryState isLoading={isLoading} error={error} />
      <ScrollArea className="h-80">
        <div className="space-y-2 pr-4">
          {groups?.map((group) => (
            <div
              key={group.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <p className="text-sm font-medium">{group.name}</p>
              <div className="flex items-center gap-1">
                <AccountGroupEditDialog group={group} />
                <ConfirmDeleteButton
                  onConfirm={() => deleteGroup.mutate(group.id)}
                  isPending={deleteGroup.isPending}
                  title={`Hapus group "${group.name}"?`}
                  description="Akun yang berada di group ini tidak akan ikut terhapus."
                />
              </div>
            </div>
          ))}
          {groups && groups.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Belum ada group. Tambahkan lewat tombol di atas.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
