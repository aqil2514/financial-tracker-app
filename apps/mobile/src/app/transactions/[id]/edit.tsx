import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDatabase } from "@/lib/database";
import { TransactionForm, type TransactionFormRef } from "@/features/transactions/form/transaction-form";
import type { TransactionFormOutput, TransactionFormValues } from "@/features/transactions/form/schema";
import { AttachmentUploader } from "@/shared/attachments";
import {
  applyDebtTransactionEdit,
  applyDirectDebtTransactionEdit,
  cleanupStaleDebtOnAccountChange,
  detachDebtForDeletedTransaction,
  getTransactionDebtStatus,
} from "@/shared/debts";
import {
  applyInvestmentTransactionEdit,
  detachInvestmentPurchaseForDeletedTransaction,
  detachInvestmentSaleForDeletedTransaction,
  getTransactionInvestmentSale,
  InvestmentPurchaseEditBlockedError,
} from "@/shared/investments";

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

function toFormValues(
  row: TransactionRow,
  contactId: string | null,
  settleDebtIds: string[]
): TransactionFormValues {
  return {
    type: row.type,
    amount: row.amount,
    account_id: row.account_id,
    category_id: row.category_id,
    transfer_account_id: row.transfer_account_id,
    note: row.note,
    description: row.description,
    date: row.date,
    contact_id: contactId,
    settle_debt_ids: settleDebtIds,
  };
}

async function loadDebtContactId(
  db: ReturnType<typeof useDatabase>,
  debtId: string
): Promise<string | null> {
  const debt = await db.getFirstAsync<{ contact_id: string | null }>(
    "SELECT contact_id FROM debts WHERE id = ?",
    [debtId]
  );
  return debt?.contact_id ?? null;
}

export default function EditTransactionPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();
  const formRef = useRef<TransactionFormRef>(null);
  const [defaultValues, setDefaultValues] = useState<TransactionFormValues | null>(null);
  const [originalRow, setOriginalRow] = useState<TransactionRow | null>(null);
  const [originalContactId, setOriginalContactId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    async function load() {
      const row = await db.getFirstAsync<TransactionRow>(
        "SELECT * FROM transactions WHERE id = ?",
        [id]
      );
      if (!row) return;

      const status = await getTransactionDebtStatus(db, id);
      let contactId: string | null = null;
      const settleDebtIds: string[] = [];

      if (status.role === "principal") {
        contactId = await loadDebtContactId(db, status.debtId);
      } else if (status.role === "payment") {
        contactId = await loadDebtContactId(db, status.debtId);
        settleDebtIds.push(status.debtId);
      }

      setOriginalRow(row);
      setOriginalContactId(contactId);
      setDefaultValues(toFormValues(row, contactId, settleDebtIds));
    }
    load();
  }, [db, id]);

  async function handleSubmit(values: TransactionFormOutput) {
    const debtError = formRef.current?.validateDebtFields(values);
    if (debtError) {
      Alert.alert("Tidak bisa disimpan", debtError);
      return;
    }
    if (!originalRow) return;

    // Kedua leg penjualan investasi (transfer + penyesuaian P/L) nilainya turunan dari average cost saat
    // dijual; mengeditnya lewat form umum merusak kaitannya. Hapus lalu catat ulang dari layar Investasi.
    if ((await getTransactionInvestmentSale(db, id)).role === "sale") {
      Alert.alert(
        "Tidak bisa diedit",
        "Transaksi ini bagian dari penjualan investasi. Hapus transaksinya (penjualan ikut terhapus), lalu catat ulang dari layar Investasi."
      );
      return;
    }

    setIsPending(true);
    try {
      // Sebelum menulis apa pun: penolakan tidak boleh meninggalkan transaksi yang sudah berubah.
      try {
        await applyInvestmentTransactionEdit({
          db,
          transactionId: id,
          type: values.type,
          accountId: values.account_id,
          transferAccountId: values.transfer_account_id,
          date: values.date,
        });
      } catch (error) {
        if (error instanceof InvestmentPurchaseEditBlockedError) {
          Alert.alert("Tidak bisa disimpan", error.message);
          return;
        }
        throw error;
      }

      const dangerousFieldsChanged =
        values.type !== originalRow.type ||
        values.account_id !== originalRow.account_id ||
        values.transfer_account_id !== originalRow.transfer_account_id ||
        values.amount !== originalRow.amount ||
        values.contact_id !== originalContactId;

      await cleanupStaleDebtOnAccountChange(
        db,
        id,
        { accountId: originalRow.account_id, transferAccountId: originalRow.transfer_account_id },
        { accountId: values.account_id, transferAccountId: values.transfer_account_id }
      );

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

      // Status di-query ULANG setelah cleanup (bukan dipakai dari effect
      // load) — cleanupStaleDebtOnAccountChange bisa saja sudah mengubah
      // role transaksi ini (mis. detach principal) sebelum baris ini
      // jalan, jadi status versi lama berisiko stale.
      const status = await getTransactionDebtStatus(db, id);

      if (values.type === "transfer") {
        await applyDebtTransactionEdit({
          db,
          transactionId: id,
          type: values.type,
          accountId: values.account_id,
          transferAccountId: values.transfer_account_id,
          contactId: values.contact_id,
          amount: values.amount,
          date: values.date,
          settleDebtIds: values.settle_debt_ids,
          status,
          dangerousFieldsChanged,
        });
      } else {
        const sourceAccount = await db.getFirstAsync<{ account_type: "cash" | "debt" }>(
          "SELECT account_type FROM accounts WHERE id = ?",
          [values.account_id]
        );
        if (sourceAccount?.account_type === "debt") {
          await applyDirectDebtTransactionEdit({
            db,
            transactionId: id,
            type: values.type,
            accountId: values.account_id,
            contactId: values.contact_id,
            amount: values.amount,
            date: values.date,
            settleDebtIds: values.settle_debt_ids,
            status,
            dangerousFieldsChanged,
          });
        }
      }

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
          // `as` supaya TS tidak mempersempit ke { role: "none" } (nilainya baru diisi di dalam closure).
          let result = { role: "none" } as Awaited<ReturnType<typeof detachDebtForDeletedTransaction>>;
          let investmentResult = { role: "none" } as Awaited<
            ReturnType<typeof detachInvestmentPurchaseForDeletedTransaction>
          >;
          let saleResult = { role: "none" } as Awaited<ReturnType<typeof detachInvestmentSaleForDeletedTransaction>>;
          try {
            await db.withTransactionAsync(async () => {
              result = await detachDebtForDeletedTransaction(db, id);
              investmentResult = await detachInvestmentPurchaseForDeletedTransaction(db, id);
              saleResult = await detachInvestmentSaleForDeletedTransaction(db, id);
              await db.runAsync("DELETE FROM transactions WHERE id = ?", [id]);
            });
          } catch (error) {
            if (error instanceof InvestmentPurchaseEditBlockedError) {
              Alert.alert("Tidak bisa dihapus", error.message);
              return;
            }
            throw error;
          }
          router.back();

          if (saleResult.role === "sale") {
            Alert.alert(
              "Penjualan investasi ikut dihapus",
              "Baris penjualan dan transaksi pasangannya (transfer dan penyesuaian P/L) dihapus bersamanya; unit kembali ke akun investasi."
            );
          }

          if (investmentResult.role === "purchase") {
            Alert.alert(
              "Pembelian investasi ikut dihapus",
              "Riwayat pembelian yang lahir dari transaksi ini dihapus bersamanya, dan modal akun investasi menyesuaikan."
            );
          }

          if (result.role === "principal") {
            Alert.alert(
              "Transaksi terkait piutang/utang dihapus",
              "Riwayat piutang/utang tetap tersimpan, cuma kehilangan tautan ke transaksi ini."
            );
          } else if (result.role === "payment") {
            Alert.alert(
              "Transaksi cicilan dihapus",
              "Cicilan ini dibatalkan — status piutang/utang terkait disesuaikan ulang."
            );
          }
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
              ref={formRef}
              defaultValues={defaultValues}
              onSubmit={handleSubmit}
              isPending={isPending}
              submitLabel="Simpan Perubahan"
              onDelete={handleDelete}
              transactionId={id}
            />
            <AttachmentUploader transactionId={id} />
          </>
        )}
      </KeyboardAwareScrollView>
    </>
  );
}
