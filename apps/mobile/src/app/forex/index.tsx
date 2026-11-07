import { ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ForexAccountCard } from "@/features/forex/content/forex-account-card";
import { ForexSummaryStats } from "@/features/forex/content/forex-summary-stats";
import { useForexAccounts } from "@/features/forex/content/use-forex";

export default function ForexPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accounts, isLoading } = useForexAccounts();

  return (
    <>
      <Stack.Screen options={{ title: "Valas" }} />
      {!isLoading && accounts.length === 0 ? (
        <View className="flex-1 items-center justify-center bg-white px-4">
          <Text className="text-center text-neutral-500">
            Belum ada akun valas. Buat lewat menu Akun dengan tipe Valas.
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
              <ForexSummaryStats accounts={accounts} />
              <View className="gap-3">
                {accounts.map((account) => (
                  <ForexAccountCard
                    key={account.id}
                    account={account}
                    onPress={() => router.push({ pathname: "/forex/[id]", params: { id: account.id } })}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </>
  );
}
