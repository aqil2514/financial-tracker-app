import { TransactionList } from "./list";
import { TransactionCalendarPanel } from "./calendar";

export function TransactionsContent() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_420px]">
      <TransactionList />
      <TransactionCalendarPanel />
    </div>
  );
}
