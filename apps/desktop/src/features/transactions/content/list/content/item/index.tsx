"use client";

import type { TransactionListRow } from "../../use-transactions";
import { ItemActions } from "./actions";
import { ItemInfo } from "./info";

export const TransactionListItem = ({ tx }: { tx: TransactionListRow }) => {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <ItemInfo tx={tx} />
      <ItemActions tx={tx} />
    </div>
  );
};
