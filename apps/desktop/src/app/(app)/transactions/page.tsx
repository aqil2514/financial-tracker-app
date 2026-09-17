"use client";

import { useState } from "react";
import { format } from "date-fns";

import {
  TransactionCalendarPanel,
  TransactionFormDialog,
  TransactionList,
} from "@/features/transactions";

export default function TransactionsPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const dateFilter = selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transaksi</h1>
        <TransactionFormDialog />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_420px]">
        <TransactionList dateFilter={dateFilter} />
        <TransactionCalendarPanel
          selectedDate={selectedDate}
          onSelectedDateChange={setSelectedDate}
        />
      </div>
    </div>
  );
}
