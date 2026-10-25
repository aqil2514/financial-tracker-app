import { useState } from "react";
import { ScrollView } from "react-native";
import { Stack, useRouter } from "expo-router";
import { generateId, useDatabase } from "@/lib/database";
import { TransactionForm } from "@/features/transactions/form/transaction-form";
import { emptyTransactionValues } from "@/features/transactions/form/values";
import type { TransactionFormOutput } from "@/features/transactions/form/schema";

export default function NewTransactionPage() {
  const router = useRouter();
  const db = useDatabase();
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(values: TransactionFormOutput) {
    setIsPending(true);
    try {
      await db.runAsync(
        `INSERT INTO transactions
          (id, note, description, type, amount, date, category_id, account_id, transfer_account_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(),
          values.note,
          values.description,
          values.type,
          values.amount,
          values.date,
          values.category_id,
          values.account_id,
          values.transfer_account_id,
        ]
      );
      router.back();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Tambah Transaksi" }} />
      <ScrollView className="flex-1 bg-white" contentContainerClassName="p-4">
        <TransactionForm
          defaultValues={emptyTransactionValues()}
          onSubmit={handleSubmit}
          isPending={isPending}
          submitLabel="Tambah Transaksi"
        />
      </ScrollView>
    </>
  );
}
