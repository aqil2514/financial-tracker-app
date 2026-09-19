"use client";

import { Card } from "@/components/ui/card";
import { ListProvider } from "./list-context";
import { ListCardHeader } from "./list-card-header";
import { ListCardContent } from "./list-card-content";
import { ListCardFooter } from "./list-card-footer";

export function TransactionList() {
  return (
    <ListProvider>
      <Card>
        <ListCardHeader />
        <ListCardContent />
        <ListCardFooter />
      </Card>
    </ListProvider>
  );
}

export { useTransactions, transactionsQueryKey } from "./use-transactions";
export { useDeleteTransaction } from "./use-delete-transaction";
