import { Alert, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatCurrency } from "@/lib/utils";
import { InvestmentActions } from "@/features/investments/content/investment-actions";
import { InvestmentPlStats } from "@/features/investments/content/investment-pl-stats";
import { PurchaseRow } from "@/features/investments/content/purchase-row";
import { SaleRow } from "@/features/investments/content/sale-row";
import { SettlementBreakdown } from "@/features/investments/content/settlement-breakdown";
import { useInvestmentDetail } from "@/features/investments/content/use-investment-detail";

export default function InvestmentDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { detail, isLoading } = useInvestmentDetail(id);

  if (!detail) {
    return (
      <>
        <Stack.Screen options={{ title: "Detail Investasi" }} />
        <View className="flex-1 items-center justify-center bg-white px-4">
          <Text className="text-center text-neutral-500">
            {isLoading ? "Memuat..." : "Akun tidak ditemukan."}
          </Text>
        </View>
      </>
    );
  }

  const { account, purchases, sales } = detail;

  return (
    <>
      <Stack.Screen options={{ title: account.name }} />
      <ScrollView
        className="flex-1 bg-white"
        contentContainerClassName="gap-4 p-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      >
        <Text className="text-sm text-neutral-500">Modal: {formatCurrency(account.balance)}</Text>

        <InvestmentPlStats
          account={account}
          purchases={purchases}
          onPressUpdateMarketValue={() => Alert.alert("Segera hadir", "Update nilai pasar belum tersedia.")}
        />
        <InvestmentActions />
        <SettlementBreakdown purchases={purchases} />

        <View className="gap-2">
          <Text className="font-semibold text-neutral-900">Riwayat Pembelian</Text>
          {purchases.length === 0 ? (
            <Text className="text-neutral-500">Belum ada riwayat pembelian.</Text>
          ) : (
            purchases.map((purchase) => (
              <PurchaseRow key={purchase.id} purchase={purchase} unitLabel={account.unitLabel} />
            ))
          )}
        </View>

        <View className="gap-2">
          <Text className="font-semibold text-neutral-900">Riwayat Penjualan</Text>
          {sales.length === 0 ? (
            <Text className="text-neutral-500">Belum ada riwayat penjualan.</Text>
          ) : (
            sales.map((sale) => <SaleRow key={sale.id} sale={sale} unitLabel={account.unitLabel} />)
          )}
        </View>
      </ScrollView>
    </>
  );
}
