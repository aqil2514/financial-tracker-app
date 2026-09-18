"use client";

import { useMemo, useState } from "react";

import type { AccountGroup } from "@/lib/db";
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
import { Trash2 } from "lucide-react";
import { useAccounts } from "@/hooks/resources/use-accounts";
import { useAccountGroups } from "@/hooks/resources/use-account-groups";
import { useDeleteAccountGroup } from "./use-delete-account-group";

type MemberAction = "unassign" | "reassign";

export function DeleteAccountGroupDialog({ group }: { group: AccountGroup }) {
  const [open, setOpen] = useState(false);
  const [memberAction, setMemberAction] = useState<MemberAction>("unassign");
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);

  const { data: accounts } = useAccounts();
  const { data: groups } = useAccountGroups();
  const deleteGroup = useDeleteAccountGroup();

  const memberCount = useMemo(
    () => accounts?.filter((account) => account.group_id === group.id).length ?? 0,
    [accounts, group.id]
  );
  const otherGroups = useMemo(
    () => (groups ?? []).filter((g) => g.id !== group.id),
    [groups, group.id]
  );

  function handleConfirm() {
    deleteGroup.mutate(
      {
        id: group.id,
        memberAction: memberCount > 0 ? memberAction : undefined,
        targetGroupId:
          memberCount > 0 && memberAction === "reassign" && targetGroupId
            ? Number(targetGroupId)
            : undefined,
      },
      { onSuccess: () => setOpen(false) }
    );
  }

  const canConfirm =
    memberCount === 0 ||
    memberAction === "unassign" ||
    (memberAction === "reassign" && targetGroupId != null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Trash2 className="text-destructive size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus group &quot;{group.name}&quot;?</DialogTitle>
          <DialogDescription>
            {memberCount === 0
              ? "Tindakan ini tidak bisa dibatalkan."
              : `Group ini masih punya ${memberCount} akun anggota. Pilih apa yang terjadi pada akun-akun tersebut.`}
          </DialogDescription>
        </DialogHeader>

        {memberCount > 0 && (
          <div className="space-y-3">
            <ToggleGroup
              value={[memberAction]}
              onValueChange={(values: string[]) => {
                if (values.length > 0) {
                  setMemberAction(values[values.length - 1] as MemberAction);
                }
              }}
              className="w-full"
            >
              <ToggleGroupItem value="unassign" className="flex-1">
                Lepas ke Tanpa Group
              </ToggleGroupItem>
              <ToggleGroupItem
                value="reassign"
                className="flex-1"
                disabled={otherGroups.length === 0}
              >
                Pindahkan ke group lain
              </ToggleGroupItem>
            </ToggleGroup>

            {memberAction === "reassign" && (
              <Select value={targetGroupId ?? ""} onValueChange={setTargetGroupId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih group tujuan..." />
                </SelectTrigger>
                <SelectContent>
                  {otherGroups.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleteGroup.isPending}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm || deleteGroup.isPending}
          >
            {deleteGroup.isPending ? "Menghapus..." : "Hapus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
