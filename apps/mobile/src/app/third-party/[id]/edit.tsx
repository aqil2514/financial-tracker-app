import { useEffect, useState } from "react";
import { Alert, Text } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDatabase } from "@/lib/database";
import { EditFundForm } from "@/features/third-party/form/edit-fund-form";
import type { EditFundFormOutput } from "@/features/third-party/form/schema";
import {
  getThirdPartyFund,
  InsufficientThirdPartyFundError,
  ThirdPartyFundEditBlockedError,
  updateThirdPartyFund,
  type ThirdPartyFundHistoryRow,
} from "@/shared/third-party-funds";

const DEFAULT_NOTE = { in: "Titip dana", out: "Ambil dana" } as const;

export default function EditThirdPartyFundPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();
  const [fund, setFund] = useState<ThirdPartyFundHistoryRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    getThirdPartyFund(db, id)
      .then(setFund)
      .finally(() => setIsLoading(false));
  }, [db, id]);

  async function handleSubmit(values: EditFundFormOutput) {
    if (!fund) return;
    setIsPending(true);
    try {
      await updateThirdPartyFund({
        db,
        fundId: fund.id,
        amount: values.amount,
        date: values.date,
        note: values.note.trim() || DEFAULT_NOTE[fund.direction],
      });
      router.back();
    } catch (error) {
      if (error instanceof InsufficientThirdPartyFundError || error instanceof ThirdPartyFundEditBlockedError) {
        Alert.alert("Tidak bisa disimpan", error.message);
      } else {
        Alert.alert("Gagal menyimpan", error instanceof Error ? error.message : "Terjadi kesalahan.");
      }
    } finally {
      setIsPending(false);
    }
  }

  const editable = fund != null && !fund.isTransfer;

  return (
    <>
      <Stack.Screen options={{ title: "Edit Riwayat" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="gap-4 p-4 pb-12"
        bottomOffset={20}
      >
        {isLoading ? (
          <Text className="text-neutral-500">Memuat...</Text>
        ) : !fund ? (
          <Text className="text-neutral-500">Riwayat tidak ditemukan.</Text>
        ) : !editable ? (
          <Text className="text-neutral-500">
            Riwayat pindah tempat/kepemilikan tidak bisa diedit. Hapus lalu catat ulang.
          </Text>
        ) : (
          <>
            <Text className="text-sm text-neutral-500">
              {fund.direction === "in" ? "Titip" : "Ambil"} · {fund.contactName} · {fund.accountName}
            </Text>
            <Text className="-mt-2 text-xs text-neutral-500">
              Akun, kontak, dan jenis tidak bisa diubah. Kalau salah, hapus lalu catat ulang.
            </Text>
            <EditFundForm
              defaultValues={{ amount: fund.amount, date: fund.date, note: fund.note ?? "" }}
              onSubmit={handleSubmit}
              isPending={isPending}
            />
          </>
        )}
      </KeyboardAwareScrollView>
    </>
  );
}
