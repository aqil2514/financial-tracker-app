import { ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { InvestmentAccountCard } from "@/features/investments/content/investment-account-card";
import { InvestmentSummaryStats } from "@/features/investments/content/investment-summary-stats";
import { MOCK_INVESTMENT_ACCOUNTS } from "@/features/investments/mock-data";

export default function InvestmentsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const accounts = MOCK_INVESTMENT_ACCOUNTS;

  return (
    <>
      <Stack.Screen options={{ title: "Investasi" }} />
      {accounts.length === 0 ? (
        <View className="flex-1 items-center justify-center bg-white px-4">
          <Text className="text-center text-neutral-500">Belum ada akun investasi.</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1 bg-white"
          contentContainerClassName="gap-4 p-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        >
          <InvestmentSummaryStats accounts={accounts} />
          <View className="gap-3">
            {accounts.map((account) => (
              <InvestmentAccountCard
                key={account.id}
                account={account}
                onPress={() => router.push({ pathname: "/investments/[id]", params: { id: account.id } })}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </>
  );
}
