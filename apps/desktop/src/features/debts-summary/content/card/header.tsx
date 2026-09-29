"use client";

import { Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardHeader } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useContactCard } from "./context";

export function ContactCardHeader() {
  const { contact, setDetailOpen } = useContactCard();
  const hasReceivable = contact.receivable_active > 0;
  const hasPayable = contact.payable_active > 0;

  return (
    <CardHeader>
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{contact.contact_name}</p>
        <div className="flex items-center gap-1">
          {hasReceivable && <Badge variant="secondary">Piutang</Badge>}
          {hasPayable && <Badge variant="destructive">Utang</Badge>}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDetailOpen(true)}
                />
              }
            >
              <Info />
            </TooltipTrigger>
            <TooltipContent>Lihat detail riwayat</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </CardHeader>
  );
}
