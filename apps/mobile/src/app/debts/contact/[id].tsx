import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useDatabase } from "@/lib/database";
import { formatCurrency } from "@/lib/utils";
import { useContactDebts } from "@/features/debts/content/use-contact-debts";
import { DebtRow } from "@/features/debts/content/debt-row";
import type { ContactDebtRow } from "@/shared/debts";

function summarize(debts: ContactDebtRow[], type: "receivable" | "payable") {
  const filtered = debts.filter((debt) => debt.type === type);
  return {
    total: filtered.reduce((sum, debt) => sum + debt.amount, 0),
    remaining: filtered.reduce((sum, debt) => sum + debt.remaining, 0),
    count: filtered.length,
  };
}

function SummaryBlock({
  label,
  total,
  remaining,
  count,
  tone,
}: {
  label: string;
  total: number;
  remaining: number;
  count: number;
  tone: "receivable" | "payable";
}) {
  const toneClass = tone === "receivable" ? "text-green-700" : "text-red-700";

  return (
    <View className="flex-1 gap-1 rounded-md border border-neutral-200 p-3">
      <Text className="text-xs text-neutral-500">
        {label} ({count})
      </Text>
      <Text className={`text-lg font-semibold ${toneClass}`}>{formatCurrency(total)}</Text>
      <Text className="text-xs text-neutral-500">Sisa: {formatCurrency(remaining)}</Text>
    </View>
  );
}

export default function ContactDebtDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const [contactName, setContactName] = useState<string | null>(null);
  const { debts, isLoading } = useContactDebts(id);

  useEffect(() => {
    db.getFirstAsync<{ name: string }>("SELECT name FROM contacts WHERE id = ?", [id]).then((row) => {
      setContactName(row?.name ?? null);
    });
  }, [db, id]);

  return (
    <>
      <Stack.Screen options={{ title: contactName ?? "Detail Kontak" }} />
      <ScrollView className="flex-1 bg-white" contentContainerClassName="gap-4 p-4">
        {isLoading || !debts ? (
          <Text className="text-neutral-500">Memuat...</Text>
        ) : (
          <>
            <View className="flex-row gap-3">
              <SummaryBlock label="Piutang" tone="receivable" {...summarize(debts, "receivable")} />
              <SummaryBlock label="Utang" tone="payable" {...summarize(debts, "payable")} />
            </View>

            {debts.length === 0 ? (
              <Text className="text-neutral-500">Belum ada riwayat piutang/utang.</Text>
            ) : (
              <View className="gap-2">
                {debts.map((debt) => (
                  <DebtRow key={debt.id} debt={debt} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}
