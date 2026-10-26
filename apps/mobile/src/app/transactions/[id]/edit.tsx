import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDatabase } from "@/lib/database";
import { TransactionForm } from "@/features/transactions/form/transaction-form";
import type { TransactionFormOutput, TransactionFormValues } from "@/features/transactions/form/schema";
import { AttachmentUploader } from "@/shared/attachments";

interface TransactionRow {
  note: string;
  description: string | null;
  type: "income" | "expense" | "transfer";
  amount: number;
  date: string;
  category_id: string | null;
  account_id: string;
  transfer_account_id: string | null;
}

function toFormValues(row: TransactionRow): TransactionFormValues {
  return {
    type: row.type,
    amount: row.amount,
    account_id: row.account_id,
    category_id: row.category_id,
    transfer_account_id: row.transfer_account_id,
    note: row.note,
    description: row.description,
    date: row.date,
  };
}

export default function EditTransactionPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();
  const [defaultValues, setDefaultValues] = useState<TransactionFormValues | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    db.getFirstAsync<TransactionRow>("SELECT * FROM transactions WHERE id = ?", [id]).then(
      (row) => {
        if (row) setDefaultValues(toFormValues(row));
      }
    );
  }, [db, id]);

  async function handleSubmit(values: TransactionFormOutput) {
    setIsPending(true);
    try {
      await db.runAsync(
        `UPDATE transactions
         SET note = ?, description = ?, type = ?, amount = ?, date = ?,
             category_id = ?, account_id = ?, transfer_account_id = ?
         WHERE id = ?`,
        [
          values.note,
          values.description,
          values.type,
          values.amount,
          values.date,
          values.category_id,
          values.account_id,
          values.transfer_account_id,
          id,
        ]
      );
      router.back();
    } finally {
      setIsPending(false);
    }
  }

  function handleDelete() {
    Alert.alert("Hapus transaksi ini?", "Tindakan ini tidak bisa dibatalkan.", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          await db.runAsync("DELETE FROM transactions WHERE id = ?", [id]);
          router.back();
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: "Edit Transaksi" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="p-4 pb-12"
        bottomOffset={20}
      >
        {defaultValues && (
          <>
            <TransactionForm
              defaultValues={defaultValues}
              onSubmit={handleSubmit}
              isPending={isPending}
              submitLabel="Simpan Perubahan"
              onDelete={handleDelete}
            />
            <AttachmentUploader transactionId={id} />
          </>
        )}
      </KeyboardAwareScrollView>
    </>
  );
}
