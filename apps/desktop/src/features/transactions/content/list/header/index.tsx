"use client";

import { CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionListFilter } from "./filter";
import { TransactionListSort } from "./sort";

export function ListCardHeader() {
  return (
    <CardHeader className="flex flex-wrap items-center justify-between gap-2">
      <CardTitle>Daftar Transaksi</CardTitle>
      <div className="flex flex-wrap items-center gap-2">
        <TransactionListSort />
        <TransactionListFilter />
      </div>
    </CardHeader>
  );
}
