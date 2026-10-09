"use client";

import { AlignLeft, FileText, ImageIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { typeConfig } from "../../../../shared/constants";
import { useList } from "../../context";
import { splitEffectiveLabels, type TransactionListRow } from "../../use-transactions";

export const ItemInfo = ({ tx }: { tx: TransactionListRow }) => {
  const { accountNameParts, categoryName } = useList().lookup;
  const config = typeConfig[tx.type];
  const Icon = config.icon;

  const from = accountNameParts(tx.account_id);
  const to = tx.type === "transfer" ? accountNameParts(tx.transfer_account_id) : null;
  const accountLine = to ? `${from.name} → ${to.name}` : from.name;
  const groups = [...new Set([from.group, to?.group].filter(Boolean))] as string[];

  return (
    <div className="flex items-center gap-3">
      <Icon className={`size-5 shrink-0 ${config.className}`} />
      <div className="space-y-1">
        <p className="font-medium">{tx.note}</p>
        <div className="flex items-center gap-2">
          {categoryName(tx.category_id) && (
            <Badge variant="secondary">{categoryName(tx.category_id)}</Badge>
          )}
          {/* Label EFEKTIF (hasil fallback transaksi->kategori, lihat
            EFFECTIVE_LABELS_SUBQUERY) -- beda variant dari badge kategori
            di atas supaya keduanya tidak ambigu, label bisa >1 sekaligus
            (keputusan 2026-10-09), ditampilkan semua tanpa batas. */}
          {splitEffectiveLabels(tx.effective_labels).map((name) => (
            <Badge key={name} variant="outline">
              {name}
            </Badge>
          ))}
          {(!!tx.has_attachment || tx.description) && (
            <TooltipProvider delay={200}>
              {!!tx.has_image_attachment && (
                <Tooltip>
                  <TooltipTrigger render={<ImageIcon className="text-muted-foreground size-3.5" />} />
                  <TooltipContent>Ada lampiran foto</TooltipContent>
                </Tooltip>
              )}
              {!!tx.has_pdf_attachment && (
                <Tooltip>
                  <TooltipTrigger render={<FileText className="text-muted-foreground size-3.5" />} />
                  <TooltipContent>Ada lampiran PDF</TooltipContent>
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
        <div className="flex items-center gap-2">
          <p className="text-sm">{accountLine}</p>
          {groups.map((group) => (
            <Badge key={group} variant="outline" className="text-muted-foreground">
              {group}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
};
