import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDatabase } from "@/lib/database";
import { formatCurrency } from "@/lib/utils";
import {
  deleteThirdPartyFundEntry,
  ThirdPartyFundEditBlockedError,
  type ThirdPartyFundHistoryRow,
} from "@/shared/third-party-funds";
import { StatItem } from "@/features/investments/content/stat-item";
import { ThirdPartyAccountCard } from "@/features/third-party/content/third-party-account-card";
import { ThirdPartyFundRow } from "@/features/third-party/content/third-party-fund-row";
import { ThirdPartySummarySection } from "@/features/third-party/content/third-party-summary-section";
import { useThirdPartyData } from "@/features/third-party/content/use-third-party-data";

function SectionTitle({ children }: { children: string }) {
  return <Text className="text-base font-semibold text-neutral-900">{children}</Text>;
}

export default function ThirdPartyPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDatabase();
  const { accounts, summary, history, isLoading, refetch } = useThirdPartyData();
  const totalHeld = accounts.reduce((sum, account) => sum + account.balance, 0);

  function confirmDelete(fund: ThirdPartyFundHistoryRow) {
    Alert.alert(
      "Hapus riwayat ini?",
      fund.isTransfer
        ? "Ini bagian dari pindah tempat/kepemilikan. Baris pasangannya ikut terhapus sekaligus."
        : "Transaksi terkait ikut terhapus. Tindakan ini tidak bisa dibatalkan.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteThirdPartyFundEntry(db, fund.id);
              await refetch();
            } catch (error) {
              if (error instanceof ThirdPartyFundEditBlockedError) {
                Alert.alert("Tidak bisa dihapus", error.message);
              } else {
                Alert.alert("Gagal menghapus", error instanceof Error ? error.message : "Terjadi kesalahan.");
              }
            }
          },
        },
      ]
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Dana Pihak Ketiga" }} />
      {!isLoading && accounts.length === 0 ? (
        <View className="flex-1 items-center justify-center bg-white px-4">
          <Text className="text-center text-neutral-500">
            Belum ada akun dana pihak ketiga. Buat lewat menu Akun dengan tipe Dana Pihak Ketiga.
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1 bg-white"
          contentContainerClassName="gap-4 p-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        >
          {isLoading && accounts.length === 0 ? (
            <Text className="text-neutral-500">Memuat...</Text>
          ) : (
            <>
              <View className="flex-row flex-wrap rounded-lg border border-neutral-200 bg-white px-4 py-2">
                <StatItem label="Total Titipan" value={formatCurrency(totalHeld)} />
                <StatItem label="Jumlah Akun" value={String(accounts.length)} />
              </View>

              <View className="flex-row gap-2">
                <Pressable
                  className="flex-1 items-center rounded-md border border-neutral-300 py-2"
                  onPress={() => router.push({ pathname: "/third-party/record", params: { direction: "in" } })}
                >
                  <Text className="text-sm font-medium text-neutral-900">Titip</Text>
                </Pressable>
                <Pressable
                  className="flex-1 items-center rounded-md border border-neutral-300 py-2"
                  onPress={() => router.push({ pathname: "/third-party/record", params: { direction: "out" } })}
                >
                  <Text className="text-sm font-medium text-neutral-900">Ambil</Text>
                </Pressable>
                <Pressable
                  className="flex-1 items-center rounded-md border border-neutral-300 py-2"
                  onPress={() => router.push("/third-party/move")}
                >
                  <Text className="text-sm font-medium text-neutral-900">Pindah</Text>
                </Pressable>
              </View>

              <View className="gap-2">
                <SectionTitle>Ringkasan per Kontak</SectionTitle>
                <ThirdPartySummarySection summary={summary} />
              </View>

              <View className="gap-2">
                <SectionTitle>Akun</SectionTitle>
                {accounts.map((account) => (
                  <ThirdPartyAccountCard key={account.id} account={account} />
                ))}
              </View>

              <View className="gap-2">
                <SectionTitle>Riwayat</SectionTitle>
                {history.length === 0 ? (
                  <Text className="text-sm text-neutral-500">Belum ada riwayat titip/ambil.</Text>
                ) : (
                  history.map((fund) => (
                    <ThirdPartyFundRow
                      key={fund.id}
                      fund={fund}
                      onPress={
                        fund.isTransfer
                          ? undefined
                          : () => router.push({ pathname: "/third-party/[id]/edit", params: { id: fund.id } })
                      }
                      onDelete={() => confirmDelete(fund)}
                    />
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </>
  );
}
