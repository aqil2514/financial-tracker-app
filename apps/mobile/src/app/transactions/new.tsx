import { useRef, useState } from "react";
import { Alert } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { generateId, useDatabase } from "@/lib/database";
import { TransactionForm, type TransactionFormRef } from "@/features/transactions/form/transaction-form";
import { emptyTransactionValues } from "@/features/transactions/form/values";
import type { TransactionFormOutput, TransactionFormValues } from "@/features/transactions/form/schema";
import { PendingAttachmentUploader } from "@/shared/attachments/pending-attachment-uploader";
import { saveAttachmentToTransaction } from "@/shared/attachments/save-pending-attachment";
import type { PendingAttachment } from "@/shared/attachments/pending-attachment";
import { applyDebtTransaction } from "@/shared/debts/apply-debt-transaction";
import { applyDirectDebtTransaction } from "@/shared/debts/apply-direct-debt-transaction";

// Draft "Bayar" dari row di halaman Utang Piutang (app/debts/list.tsx)
// — tombol per-row push ke sini dengan query params alih-alih dialog
// shortcut terpisah, sesuai keputusan "jalur form transaksi umum sudah
// cukup" di docs/todos/plan/porting-account-debt.md. Piutang dilunasi
// debt->cash (account_id = akun debt), utang dilunasi cash->debt
// (transfer_account_id = akun debt) — user masih pilih sendiri akun
// kas pasangannya dan boleh ubah nominal/tanggal sebelum submit.
function buildPayDebtDraft(params: {
  payDebtId?: string;
  payDebtType?: string;
  payDebtAccountId?: string;
  payDebtContactId?: string;
}): TransactionFormValues | null {
  if (!params.payDebtId || !params.payDebtType || !params.payDebtAccountId) return null;

  const base = emptyTransactionValues();
  const isReceivable = params.payDebtType === "receivable";

  return {
    ...base,
    type: "transfer",
    account_id: isReceivable ? params.payDebtAccountId : "",
    transfer_account_id: isReceivable ? null : params.payDebtAccountId,
    contact_id: params.payDebtContactId || null,
    settle_debt_ids: [params.payDebtId],
  };
}

export default function NewTransactionPage() {
  const router = useRouter();
  const db = useDatabase();
  const params = useLocalSearchParams<{
    payDebtId?: string;
    payDebtType?: string;
    payDebtAccountId?: string;
    payDebtContactId?: string;
  }>();
  const formRef = useRef<TransactionFormRef>(null);
  const [isPending, setIsPending] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [defaultValues] = useState(() => buildPayDebtDraft(params) ?? emptyTransactionValues());

  async function handleSubmit(values: TransactionFormOutput) {
    const debtError = formRef.current?.validateDebtFields(values);
    if (debtError) {
      Alert.alert("Tidak bisa disimpan", debtError);
      return;
    }

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

      if (values.type === "transfer") {
        await applyDebtTransaction({
          db,
          transactionId,
          type: values.type,
          accountId: values.account_id,
          transferAccountId: values.transfer_account_id,
          contactId: values.contact_id,
          amount: values.amount,
          date: values.date,
          settleDebtIds: values.settle_debt_ids,
        });
      } else {
        const sourceAccount = await db.getFirstAsync<{ account_type: "cash" | "debt" }>(
          "SELECT account_type FROM accounts WHERE id = ?",
          [values.account_id]
        );
        if (sourceAccount?.account_type === "debt") {
          await applyDirectDebtTransaction({
            db,
            transactionId,
            type: values.type,
            accountId: values.account_id,
            contactId: values.contact_id,
            amount: values.amount,
            date: values.date,
            settleDebtIds: values.settle_debt_ids,
          });
        }
      }

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
          ref={formRef}
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
