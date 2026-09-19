"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import type { Contact } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { useDeleteContact } from "./use-delete-contact";

export function DeleteContactDialog({ contact }: { contact: Contact }) {
  const [open, setOpen] = useState(false);
  const deleteContact = useDeleteContact();

  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)}>
        <Trash2 className="text-destructive size-4" />
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        onConfirm={() => deleteContact.mutate(contact.id, { onSuccess: () => setOpen(false) })}
        isPending={deleteContact.isPending}
        title={`Hapus kontak "${contact.name}"?`}
        description="Riwayat piutang/utang yang terkait kontak ini TIDAK ikut terhapus — hanya kehilangan tautan ke nama kontaknya."
      />
    </>
  );
}
