import { TransactionFormDialog, TransactionList } from "@/features/transactions";

export default function TransactionsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transaksi</h1>
        <TransactionFormDialog />
      </div>
      <TransactionList />
    </div>
  );
}
