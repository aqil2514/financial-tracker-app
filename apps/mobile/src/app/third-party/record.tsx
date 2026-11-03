import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDatabase } from "@/lib/database";
import { RecordFundForm } from "@/features/third-party/form/record-fund-form";
import type { RecordFundFormOutput, RecordFundFormValues } from "@/features/third-party/form/schema";
import { InsufficientThirdPartyFundError, recordThirdPartyFund } from "@/shared/third-party-funds";

const DEFAULT_NOTE = { in: "Titip dana", out: "Ambil dana" } as const;

export default function RecordThirdPartyFundPage() {
  const { direction } = useLocalSearchParams<{ direction?: string }>();
  const router = useRouter();
  const db = useDatabase();
  const [isPending, setIsPending] = useState(false);
  const [accountOptions, setAccountOptions] = useState<{ value: string; label: string }[]>([]);
  const [defaultValues] = useState<RecordFundFormValues>(() => ({
    direction: direction === "out" ? "out" : "in",
    account_id: null,
    contact_id: null,
    amount: 0,
    date: new Date().toISOString(),
    note: "",
  }));

  useEffect(() => {
    db.getAllAsync<{ id: string; name: string }>(
      "SELECT id, name FROM accounts WHERE account_type = 'third_party' AND is_active = 1 ORDER BY name COLLATE NOCASE ASC"
    ).then((rows) => setAccountOptions(rows.map((row) => ({ value: row.id, label: row.name }))));
  }, [db]);

  async function handleSubmit(values: RecordFundFormOutput) {
    setIsPending(true);
    try {
      await recordThirdPartyFund({
        db,
        accountId: values.account_id as string,
        contactId: values.contact_id as string,
        direction: values.direction,
        amount: values.amount,
        date: values.date,
        note: values.note.trim() || DEFAULT_NOTE[values.direction],
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
      <Stack.Screen options={{ title: "Catat Titip/Ambil" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="gap-4 p-4 pb-12"
        bottomOffset={20}
      >
        <RecordFundForm
          defaultValues={defaultValues}
          accountOptions={accountOptions}
          onSubmit={handleSubmit}
          isPending={isPending}
        />
      </KeyboardAwareScrollView>
    </>
  );
}
