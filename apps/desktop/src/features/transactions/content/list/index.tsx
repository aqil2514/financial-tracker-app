"use client";

import { Card } from "@/components/ui/card";
import { ListProvider } from "./context";
import { ListCardHeader } from "./header";
import { ListCardContent } from "./content";
import { ListCardFooter } from "./footer";

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
export { ListProvider, useList } from "./context";
export { ListCardContent } from "./content";
export { ListCardFooter } from "./footer";
export { TransactionListFilter } from "./header/filter";
export { TransactionListSort } from "./header/sort";
