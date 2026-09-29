"use client";

import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { ContactDetailContent } from "./content";

type ContactDetailDialogProps = {
  contactId: string;
  contactName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Dialog detail satu kontak — SEMUA piutang/utang individual (bukan
 * cuma agregat ongoing seperti di card ringkasan) + riwayat cicilan per
 * baris (expandable, lihat detail/debt-row.tsx). Dialog lebih lebar dari
 * form biasa (`max-w-3xl`, sama pola dengan preview-sync-section di
 * fitur Retailku) karena datanya berjenjang (ringkasan + daftar +
 * cicilan nested), bukan form input sederhana. */
export function ContactDetailDialog({
  contactId,
  contactName,
  open,
  onOpenChange,
}: ContactDetailDialogProps) {
  return (
    <EntityFormDialog
      title={`Detail — ${contactName}`}
      open={open}
      onOpenChange={onOpenChange}
      contentClassName="sm:!max-w-3xl max-h-[85vh] overflow-y-auto"
    >
      <ContactDetailContent contactId={contactId} />
    </EntityFormDialog>
  );
}
