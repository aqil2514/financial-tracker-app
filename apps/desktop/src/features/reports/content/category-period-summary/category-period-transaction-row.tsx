"use client";

import type { AccountWithBalance } from "@/hooks/resources";
import type { Category, Transaction } from "@/lib/db";
import { formatCurrency } from "@/lib/format-currency";
import { accountName } from "@/features/transactions/shared/utils/account-name";
import { categoryName } from "@/features/transactions/shared/utils/category-name";
import { typeConfig } from "@/features/transactions/shared/constants";
import { AttachmentThumbnail, useTransactionAttachments } from "@/shared/attachments";

export function CategoryPeriodTransactionRow({
  tx,
  accounts,
  categories,
}: {
  tx: Transaction;
  accounts: AccountWithBalance[] | undefined;
  categories: Category[] | undefined;
}) {
  const config = typeConfig[tx.type as "income" | "expense"];
  const Icon = config.icon;
  const { data: attachments } = useTransactionAttachments(tx.id);

  return (
    <div className="space-y-2 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Icon className={`size-5 shrink-0 ${config.className}`} />
          <div className="space-y-1">
            <p className="font-medium">{tx.note}</p>
            <p className="text-muted-foreground text-sm">
              {accountName(accounts, tx.account_id)}
              {categoryName(categories, tx.category_id) &&
                ` · ${categoryName(categories, tx.category_id)}`}
            </p>
          </div>
        </div>
        <span className={`font-semibold whitespace-nowrap ${config.className}`}>
          {tx.type === "expense" ? "-" : "+"}
          {formatCurrency(tx.amount, "IDR")}
        </span>
      </div>

      {attachments && attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-8">
          {attachments.map((attachment) => (
            <AttachmentThumbnail key={attachment.id} attachment={attachment} />
          ))}
        </div>
      )}
    </div>
  );
}
