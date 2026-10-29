import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useDatabase } from "@/lib/database";
import { formatCurrency } from "@/lib/utils";
import { getDebtPayments, type DebtPaymentRow } from "@/shared/debts";

function formatPaymentDate(value: string): string {
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function PaymentsList({ debtId }: { debtId: string }) {
  const db = useDatabase();
  const [payments, setPayments] = useState<DebtPaymentRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDebtPayments(db, debtId).then((rows) => {
      if (!cancelled) setPayments(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [db, debtId]);

  if (payments === null) {
    return <Text className="p-3 text-sm text-neutral-500">Memuat cicilan...</Text>;
  }

  if (payments.length === 0) {
    return <Text className="p-3 text-sm text-neutral-500">Belum ada cicilan tercatat.</Text>;
  }

  return (
    <View className="divide-y divide-neutral-100">
      {payments.map((payment) => (
        <View key={payment.id} className="flex-row items-center justify-between gap-2 p-3">
          <View>
            <Text className="text-sm text-neutral-900">{formatPaymentDate(payment.date)}</Text>
            <Text className="text-xs text-neutral-500">{payment.account_name ?? "—"}</Text>
          </View>
          <Text className="font-medium text-neutral-900">{formatCurrency(payment.amount)}</Text>
        </View>
      ))}
    </View>
  );
}
