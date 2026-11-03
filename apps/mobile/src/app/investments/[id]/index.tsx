import { useRef } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDatabase } from "@/lib/database";
import { formatCurrency } from "@/lib/utils";
import { InvestmentActions } from "@/features/investments/content/investment-actions";
import { InvestmentPlStats } from "@/features/investments/content/investment-pl-stats";
import { PurchaseRow } from "@/features/investments/content/purchase-row";
import { SaleRow } from "@/features/investments/content/sale-row";
import { SettlementBreakdown } from "@/features/investments/content/settlement-breakdown";
import { UpdateMarketValueSheet, type UpdateMarketValueSheetRef } from "@/features/investments/content/update-market-value-sheet";
import { useInvestmentDetail } from "@/features/investments/content/use-investment-detail";
import { deletePendingInvestmentSale } from "@/shared/investments";

export default function InvestmentDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();
  const insets = useSafeAreaInsets();
  const { detail, isLoading, refetch } = useInvestmentDetail(id);
  const updateMarketValueRef = useRef<UpdateMarketValueSheetRef>(null);

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

  const { account, averageCostPerUnit, purchases, sales } = detail;

  function confirmDeletePendingSale(saleId: string) {
    Alert.alert("Hapus penjualan pending?", "Unit yang tertahan dikembalikan. Kas tidak berubah karena belum tersentuh.", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePendingInvestmentSale(db, saleId);
            await refetch();
          } catch (error) {
            Alert.alert("Gagal menghapus", error instanceof Error ? error.message : "Terjadi kesalahan.");
          }
        },
      },
    ]);
  }

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
          averageCost={averageCostPerUnit}
          onPressUpdateMarketValue={() => updateMarketValueRef.current?.present()}
        />
        <InvestmentActions
          onPressPurchase={() => router.push({ pathname: "/investments/[id]/purchase", params: { id: account.id } })}
          onPressSell={() => router.push({ pathname: "/investments/[id]/sell", params: { id: account.id } })}
        />
        <SettlementBreakdown purchases={purchases} />

        <View className="gap-2">
          <Text className="font-semibold text-neutral-900">Riwayat Pembelian</Text>
          {purchases.length === 0 ? (
            <Text className="text-neutral-500">Belum ada riwayat pembelian.</Text>
          ) : (
            purchases.map((purchase) => (
              <PurchaseRow
                key={purchase.id}
                purchase={purchase}
                unitLabel={account.unitLabel}
                onPress={() =>
                  router.push({
                    pathname: "/investments/[id]/edit-purchase",
                    params: { id: account.id, purchaseId: purchase.id },
                  })
                }
              />
            ))
          )}
        </View>

        <View className="gap-2">
          <Text className="font-semibold text-neutral-900">Riwayat Penjualan</Text>
          {sales.length === 0 ? (
            <Text className="text-neutral-500">Belum ada riwayat penjualan.</Text>
          ) : (
            sales.map((sale) => (
              <SaleRow
                key={sale.id}
                sale={sale}
                unitLabel={account.unitLabel}
                // Penjualan settled dikelola lewat transaksinya (lihat dan hapus di sana).
                onPress={
                  sale.transactionId
                    ? () =>
                        router.push({
                          pathname: "/transactions/[id]/edit",
                          params: { id: sale.transactionId as string },
                        })
                    : undefined
                }
                onSettle={() =>
                  router.push({
                    pathname: "/investments/[id]/settle-sale",
                    params: { id: account.id, saleId: sale.id },
                  })
                }
                onDelete={() => confirmDeletePendingSale(sale.id)}
              />
            ))
          )}
        </View>
      </ScrollView>

      <UpdateMarketValueSheet
        ref={updateMarketValueRef}
        accountId={account.id}
        currentValue={account.currentMarketValue}
        onUpdated={refetch}
      />
    </>
  );
}
