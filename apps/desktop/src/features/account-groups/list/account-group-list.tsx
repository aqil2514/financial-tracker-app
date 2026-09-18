"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { QueryState } from "@/components/query-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AccountGroupEditDialog } from "../form/account-group-edit-dialog";
import { useAccountGroups } from "@/hooks/resources/use-account-groups";
import { DeleteAccountGroupDialog } from "./delete-account-group-dialog";

export function AccountGroupList() {
  const { data: groups, isLoading, error } = useAccountGroups();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return groups;
    return groups?.filter((group) =>
      group.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [groups, search]);

  return (
    <div className="space-y-3">
      <Input
        placeholder="Cari group akun..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-56"
      />

      <QueryState isLoading={isLoading} error={error} />
      <ScrollArea className="h-80">
        <div className="space-y-2 pr-4">
          {filtered?.map((group) => (
            <div
              key={group.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <p className="text-sm font-medium">{group.name}</p>
              <div className="flex items-center gap-1">
                <AccountGroupEditDialog group={group} />
                <DeleteAccountGroupDialog group={group} />
              </div>
            </div>
          ))}
          {filtered && filtered.length === 0 && groups && groups.length > 0 && (
            <p className="text-muted-foreground text-sm">
              Tidak ada group yang cocok dengan pencarian.
            </p>
          )}
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
