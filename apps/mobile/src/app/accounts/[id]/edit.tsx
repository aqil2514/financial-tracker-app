import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDatabase } from "@/lib/database";
import { AccountForm } from "@/features/accounts/form/account-form";
import type { AccountFormOutput, AccountFormValues } from "@/features/accounts/form/schema";
import { OptionPicker, type OptionPickerRef } from "@/components/query/shared/option-picker";
import { CurrentBalanceField } from "@/features/accounts/content/current-balance-field";
import { correctAccountBalance } from "@/features/accounts/correct-account-balance";

const CURRENT_BALANCE_SQL = `
  SELECT
    accounts.initial_balance
    + COALESCE((SELECT SUM(CASE
          WHEN t.type = 'income' THEN t.amount
          WHEN t.type = 'expense' THEN -t.amount
          WHEN t.type = 'transfer' THEN -t.amount
          ELSE 0 END)
        FROM transactions t WHERE t.account_id = accounts.id), 0)
    + COALESCE((SELECT SUM(t.amount) FROM transactions t
        WHERE t.type = 'transfer' AND t.transfer_account_id = accounts.id), 0)
    AS balance
  FROM accounts
  WHERE accounts.id = ?
`;

interface AccountRow {
  name: string;
  icon: string | null;
  color: string | null;
  group_id: string | null;
  initial_balance: number;
  description: string | null;
  is_active: number;
  account_type: "cash";
}

function toFormValues(row: AccountRow): AccountFormValues {
  return {
    kind: "account",
    name: row.name,
    icon: row.icon,
    color: row.color,
    group_id: row.group_id,
    initial_balance: row.initial_balance,
    description: row.description,
    is_active: row.is_active === 1 ? "true" : "false",
    account_type: row.account_type,
  };
}

export default function EditAccountPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();
  const [defaultValues, setDefaultValues] = useState<AccountFormValues | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [otherAccounts, setOtherAccounts] = useState<{ value: string; label: string }[]>([]);
  const reassignPickerRef = useRef<OptionPickerRef>(null);
  const [originalBalance, setOriginalBalance] = useState<number | null>(null);
  const [currentBalanceInput, setCurrentBalanceInput] = useState("");

  useEffect(() => {
    db.getFirstAsync<AccountRow>(
      `SELECT name, icon, color, group_id, initial_balance, description, is_active, account_type
       FROM accounts WHERE id = ?`,
      [id]
    ).then((row) => {
      if (row) setDefaultValues(toFormValues(row));
    });

    db.getFirstAsync<{ balance: number }>(CURRENT_BALANCE_SQL, [id]).then((row) => {
      const balance = row?.balance ?? 0;
      setOriginalBalance(balance);
      setCurrentBalanceInput(String(Math.round(balance)));
    });
  }, [db, id]);

  async function saveAccountFields(values: AccountFormOutput) {
    await db.runAsync(
      `UPDATE accounts
       SET name = ?, icon = ?, color = ?, group_id = ?, initial_balance = ?, description = ?, is_active = ?
       WHERE id = ?`,
      [
        values.name,
        values.icon,
        values.color,
        values.group_id,
        values.initial_balance,
        values.description,
        values.is_active === "true" ? 1 : 0,
        id,
      ]
    );
  }

  async function handleSubmit(values: AccountFormOutput) {
    setIsPending(true);
    try {
      await saveAccountFields(values);

      const targetBalance = Number(currentBalanceInput || "0");
      if (originalBalance == null || targetBalance === originalBalance) {
        router.back();
        return;
      }

      Alert.alert(
        "Hitung sebagai kas riil?",
        "Centang Ya kalau ini memang selisih kas fisik riil (mis. ketahuan uangnya lebih/kurang) — akan ikut dihitung di laporan cashflow. Pilih Tidak kalau cuma membenarkan salah catat administratif.",
        [
          {
            text: "Tidak",
            onPress: async () => {
              await correctAccountBalance({
                db,
                accountId: id,
                targetBalance,
                currentBalance: originalBalance,
                countAsCash: false,
              });
              router.back();
            },
          },
          {
            text: "Ya",
            onPress: async () => {
              await correctAccountBalance({
                db,
                accountId: id,
                targetBalance,
                currentBalance: originalBalance,
                countAsCash: true,
              });
              router.back();
            },
          },
        ]
      );
    } finally {
      setIsPending(false);
    }
  }

  async function deleteAccount() {
    await db.runAsync("DELETE FROM accounts WHERE id = ?", [id]);
    router.back();
  }

  async function unassignAndDelete() {
    await db.runAsync(
      "UPDATE transactions SET account_id = NULL WHERE account_id = ?",
      [id]
    );
    await db.runAsync(
      "UPDATE transactions SET transfer_account_id = NULL WHERE transfer_account_id = ?",
      [id]
    );
    await deleteAccount();
  }

  async function reassignAndDelete(targetAccountId: string) {
    await db.runAsync(
      "UPDATE transactions SET account_id = ? WHERE account_id = ?",
      [targetAccountId, id]
    );
    await db.runAsync(
      "UPDATE transactions SET transfer_account_id = ? WHERE transfer_account_id = ?",
      [targetAccountId, id]
    );
    await deleteAccount();
  }

  async function openReassignPicker() {
    const rows = await db.getAllAsync<{ id: string; name: string }>(
      "SELECT id, name FROM accounts WHERE id != ? ORDER BY name ASC",
      [id]
    );

    if (rows.length === 0) {
      Alert.alert("Tidak ada akun lain", "Tidak ada akun lain untuk dipindahkan transaksinya.");
      return;
    }

    setOtherAccounts(rows.map((row) => ({ value: row.id, label: row.name })));
    reassignPickerRef.current?.present();
  }

  async function handleDelete() {
    const row = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM transactions WHERE account_id = ? OR transfer_account_id = ?",
      [id, id]
    );
    const usageCount = row?.count ?? 0;

    if (usageCount === 0) {
      Alert.alert("Hapus akun ini?", "Tindakan ini tidak bisa dibatalkan.", [
        { text: "Batal", style: "cancel" },
        { text: "Hapus", style: "destructive", onPress: deleteAccount },
      ]);
      return;
    }

    Alert.alert(
      "Hapus akun ini?",
      `Akun ini masih dipakai di ${usageCount} transaksi. Pilih apa yang terjadi pada transaksi itu.`,
      [
        { text: "Batal", style: "cancel" },
        { text: "Lepas Saja & Hapus", style: "destructive", onPress: unassignAndDelete },
        { text: "Pindahkan Transaksi Dulu", onPress: openReassignPicker },
      ]
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Edit Akun" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="p-4 pb-12"
        bottomOffset={20}
      >
        {defaultValues && (
          <>
            <View className="mb-4">
              <CurrentBalanceField value={currentBalanceInput} onChangeText={setCurrentBalanceInput} />
            </View>
            <AccountForm
              defaultValues={defaultValues}
              onSubmit={handleSubmit}
              isPending={isPending}
              submitLabel="Simpan Perubahan"
              hideKindToggle
              onDelete={handleDelete}
            />
          </>
        )}
      </KeyboardAwareScrollView>

      <OptionPicker
        ref={reassignPickerRef}
        title="Pindahkan transaksi ke akun"
        options={otherAccounts}
        value={null}
        onSelect={reassignAndDelete}
      />
    </>
  );
}
