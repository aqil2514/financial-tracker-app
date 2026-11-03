import { useEffect, useState } from "react";
import { toLocalDateTime } from "@/lib/utils/local-datetime";
import { Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDatabase } from "@/lib/database";
import { MoveFundForm } from "@/features/third-party/form/move-fund-form";
import {
  resolveMoveDestination,
  type MoveFundFormOutput,
  type MoveFundFormValues,
} from "@/features/third-party/form/schema";
import { InsufficientThirdPartyFundError, recordThirdPartyTransfer } from "@/shared/third-party-funds";

const DEFAULT_NOTE = "Pindah dana pihak ketiga";

export default function MoveThirdPartyFundPage() {
  const router = useRouter();
  const db = useDatabase();
  const [isPending, setIsPending] = useState(false);
  const [accountOptions, setAccountOptions] = useState<{ value: string; label: string }[]>([]);
  const [defaultValues] = useState<MoveFundFormValues>(() => ({
    kind: "move_location",
    source_account_id: null,
    source_contact_id: null,
    destination_account_id: null,
    destination_contact_id: null,
    amount: 0,
    date: toLocalDateTime(),
    note: "",
  }));

  useEffect(() => {
    db.getAllAsync<{ id: string; name: string }>(
      "SELECT id, name FROM accounts WHERE account_type = 'third_party' AND is_active = 1 ORDER BY name COLLATE NOCASE ASC"
    ).then((rows) => setAccountOptions(rows.map((row) => ({ value: row.id, label: row.name }))));
  }, [db]);

  async function handleSubmit(values: MoveFundFormOutput) {
    const destination = resolveMoveDestination(values);

    setIsPending(true);
    try {
      await recordThirdPartyTransfer({
        db,
        sourceAccountId: values.source_account_id as string,
        sourceContactId: values.source_contact_id as string,
        destinationAccountId: destination.accountId as string,
        destinationContactId: destination.contactId as string,
        amount: values.amount,
        date: values.date,
        note: values.note.trim() || DEFAULT_NOTE,
      });
      router.back();
    } catch (error) {
      if (error instanceof InsufficientThirdPartyFundError) {
        Alert.alert("Tidak bisa disimpan", error.message);
      } else {
        Alert.alert("Gagal menyimpan", error instanceof Error ? error.message : "Terjadi kesalahan.");
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Pindah Tempat/Kepemilikan" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="gap-4 p-4 pb-12"
        bottomOffset={20}
      >
        <MoveFundForm
          defaultValues={defaultValues}
          accountOptions={accountOptions}
          onSubmit={handleSubmit}
          isPending={isPending}
        />
      </KeyboardAwareScrollView>
    </>
  );
}
