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
