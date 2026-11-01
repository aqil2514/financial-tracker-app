import { Alert, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { formatCurrency } from "@/lib/utils";
import { InvestmentActions } from "@/features/investments/content/investment-actions";
import { InvestmentPlStats } from "@/features/investments/content/investment-pl-stats";
import { PurchaseRow } from "@/features/investments/content/purchase-row";
import { SaleRow } from "@/features/investments/content/sale-row";
import { SettlementBreakdown } from "@/features/investments/content/settlement-breakdown";
import { findMockInvestmentAccount } from "@/features/investments/mock-data";

export default function InvestmentDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = findMockInvestmentAccount(id);

  if (!account) {
    return (
      <>
        <Stack.Screen options={{ title: "Detail Investasi" }} />
        <View className="flex-1 items-center justify-center bg-white px-4">
          <Text className="text-center text-neutral-500">Akun tidak ditemukan.</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: account.name }} />
      <ScrollView className="flex-1 bg-white" contentContainerClassName="gap-4 p-4">
        <Text className="text-sm text-neutral-500">Modal: {formatCurrency(account.balance)}</Text>

        <InvestmentPlStats
          account={account}
          onPressUpdateMarketValue={() => Alert.alert("Segera hadir", "Update nilai pasar belum tersedia.")}
        />
        <InvestmentActions />
        <SettlementBreakdown purchases={account.purchases} />

        <View className="gap-2">
          <Text className="font-semibold text-neutral-900">Riwayat Pembelian</Text>
          {account.purchases.length === 0 ? (
            <Text className="text-neutral-500">Belum ada riwayat pembelian.</Text>
          ) : (
            account.purchases.map((purchase) => (
              <PurchaseRow key={purchase.id} purchase={purchase} unitLabel={account.unitLabel} />
            ))
          )}
        </View>

        <View className="gap-2">
          <Text className="font-semibold text-neutral-900">Riwayat Penjualan</Text>
          {account.sales.length === 0 ? (
            <Text className="text-neutral-500">Belum ada riwayat penjualan.</Text>
          ) : (
            account.sales.map((sale) => <SaleRow key={sale.id} sale={sale} unitLabel={account.unitLabel} />)
          )}
        </View>
      </ScrollView>
    </>
  );
}
