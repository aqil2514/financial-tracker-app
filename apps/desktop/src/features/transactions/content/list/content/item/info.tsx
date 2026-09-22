"use client";

import { AlignLeft, ImageIcon } from "lucide-react";

import { formatDate } from "@/lib/format-date";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { typeConfig } from "../../../../shared/constants";
import { useList } from "../../context";
import type { TransactionListRow } from "../../use-transactions";

export const ItemInfo = ({ tx }: { tx: TransactionListRow }) => {
  const { accountName, categoryName } = useList().lookup;
  const config = typeConfig[tx.type];
  const Icon = config.icon;
  const transactionType =
    tx.type === "transfer"
      ? `${accountName(tx.account_id)} → ${accountName(tx.transfer_account_id)}`
      : accountName(tx.account_id);

  return (
    <div className="flex items-center gap-3">
      <Icon className={`size-5 shrink-0 ${config.className}`} />
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{transactionType}</p>
          {categoryName(tx.category_id) && (
            <Badge variant="secondary">{categoryName(tx.category_id)}</Badge>
          )}
          {(!!tx.has_attachment || tx.description) && (
            <TooltipProvider delay={200}>
              {!!tx.has_attachment && (
                <Tooltip>
                  <TooltipTrigger render={<ImageIcon className="text-muted-foreground size-3.5" />} />
                  <TooltipContent>Ada lampiran foto</TooltipContent>
                </Tooltip>
              )}
              {tx.description && (
                <Tooltip>
                  <TooltipTrigger render={<AlignLeft className="text-muted-foreground size-3.5" />} />
                  <TooltipContent>Ada deskripsi</TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          {formatDate(tx.date, "date-time")}
        </p>
        {tx.note && <p className="text-muted-foreground text-xs">{tx.note}</p>}
      </div>
    </div>
  );
};
