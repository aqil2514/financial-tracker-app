"use client";

import { Badge } from "@/components/ui/badge";
import { CardHeader } from "@/components/ui/card";
import { useContactCard } from "./context";

export function ContactCardHeader() {
  const { contact } = useContactCard();
  const hasReceivable = contact.receivable_active > 0;
  const hasPayable = contact.payable_active > 0;

  return (
    <CardHeader>
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{contact.contact_name}</p>
        <div className="flex gap-1">
          {hasReceivable && <Badge variant="secondary">Piutang</Badge>}
          {hasPayable && <Badge variant="destructive">Utang</Badge>}
        </div>
      </div>
    </CardHeader>
  );
}
