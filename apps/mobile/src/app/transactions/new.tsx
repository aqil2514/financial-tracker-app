import { useState } from "react";
import { Stack, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { generateId, useDatabase } from "@/lib/database";
import { TransactionForm } from "@/features/transactions/form/transaction-form";
import { emptyTransactionValues } from "@/features/transactions/form/values";
import type { TransactionFormOutput } from "@/features/transactions/form/schema";
import { PendingAttachmentUploader } from "@/shared/attachments/pending-attachment-uploader";
import { saveAttachmentToTransaction } from "@/shared/attachments/save-pending-attachment";
import type { PendingAttachment } from "@/shared/attachments/pending-attachment";

export default function NewTransactionPage() {
  const router = useRouter();
  const db = useDatabase();
  const [isPending, setIsPending] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [defaultValues] = useState(emptyTransactionValues);

  async function handleSubmit(values: TransactionFormOutput) {
    setIsPending(true);
    try {
      const transactionId = generateId();
      await db.runAsync(
        `INSERT INTO transactions
          (id, note, description, type, amount, date, category_id, account_id, transfer_account_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionId,
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

      for (const pending of pendingAttachments) {
        await saveAttachmentToTransaction(db, transactionId, pending.input);
      }

      router.back();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Tambah Transaksi" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="p-4 pb-12"
        bottomOffset={20}
      >
        <TransactionForm
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isPending={isPending}
          submitLabel="Tambah Transaksi"
        />
        <PendingAttachmentUploader
          pendingAttachments={pendingAttachments}
          onChange={setPendingAttachments}
          disabled={isPending}
        />
      </KeyboardAwareScrollView>
    </>
  );
}
