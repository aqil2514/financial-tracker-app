import { useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ForexDetailStats } from "@/features/forex/content/forex-detail-stats";
import { ForexPurchaseRowItem, ForexSaleRowItem } from "@/features/forex/content/forex-rows";
import { UpdateRateSheet, type UpdateRateSheetRef } from "@/features/forex/content/update-rate-sheet";
import { useForexDetail } from "@/features/forex/content/use-forex";

export default function ForexDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { detail, isLoading, refetch } = useForexDetail(id);
  const updateRateRef = useRef<UpdateRateSheetRef>(null);

  if (!detail) {
    return (
      <>
        <Stack.Screen options={{ title: "Detail Valas" }} />
        <View className="flex-1 items-center justify-center bg-white px-4">
          <Text className="text-center text-neutral-500">{isLoading ? "Memuat..." : "Akun tidak ditemukan."}</Text>
        </View>
      </>
    );
  }

  const { account, purchases, sales, totalRealizedPl } = detail;

  function openTransaction(transactionId: string | null) {
    if (!transactionId) return undefined;
    return () => router.push({ pathname: "/transactions/[id]/edit", params: { id: transactionId } });
  }

  return (
    <>
      <Stack.Screen options={{ title: account.name }} />
      <ScrollView
        className="flex-1 bg-white"
        contentContainerClassName="gap-4 p-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      >
        <ForexDetailStats
          account={account}
          totalRealizedPl={totalRealizedPl}
          onPressUpdateRate={() => updateRateRef.current?.present()}
        />

        <View className="flex-row gap-2">
          <Pressable
            className="flex-1 items-center rounded-md border border-neutral-300 py-2"
            onPress={() => router.push({ pathname: "/forex/[id]/purchase", params: { id: account.id } })}
          >
            <Text className="text-sm font-medium text-neutral-900">Beli Valas</Text>
          </Pressable>
          <Pressable
            className="flex-1 items-center rounded-md border border-neutral-300 py-2"
            onPress={() => router.push({ pathname: "/forex/[id]/sell", params: { id: account.id } })}
          >
            <Text className="text-sm font-medium text-neutral-900">Jual Valas</Text>
          </Pressable>
        </View>

        <View className="gap-2">
          <Text className="font-semibold text-neutral-900">Riwayat Pembelian</Text>
          {purchases.length === 0 ? (
            <Text className="text-neutral-500">Belum ada riwayat pembelian.</Text>
          ) : (
            purchases.map((purchase) => (
              <ForexPurchaseRowItem
                key={purchase.id}
                purchase={purchase}
                currency={account.currency}
                onPress={openTransaction(purchase.transactionId)}
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
              <ForexSaleRowItem
                key={sale.id}
                sale={sale}
                currency={account.currency}
                onPress={openTransaction(sale.transactionId)}
              />
            ))
          )}
        </View>
      </ScrollView>

      <UpdateRateSheet
        ref={updateRateRef}
        accountId={account.id}
        currency={account.currency}
        remainingUnit={account.remainingUnit}
        currentRate={account.currentRate}
        onUpdated={refetch}
      />
    </>
  );
}
