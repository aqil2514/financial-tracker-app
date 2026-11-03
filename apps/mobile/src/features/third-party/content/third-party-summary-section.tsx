import { Text, View } from "react-native";
import { formatCurrency } from "@/lib/utils";
import type { ThirdPartySummaryRow } from "@/shared/third-party-funds";

// Dikelompokkan per kontak (total titipan orang itu), rinciannya per akun/tempat.
export function ThirdPartySummarySection({ summary }: { summary: ThirdPartySummaryRow[] }) {
  const byContact = new Map<string, { name: string; total: number; rows: ThirdPartySummaryRow[] }>();
  for (const row of summary) {
    const entry = byContact.get(row.contactId) ?? { name: row.contactName, total: 0, rows: [] };
    entry.total += row.remaining;
    entry.rows.push(row);
    byContact.set(row.contactId, entry);
  }

  if (byContact.size === 0) {
    return <Text className="text-sm text-neutral-500">Belum ada titipan yang tercatat.</Text>;
  }

  return (
    <View className="gap-3">
      {[...byContact.entries()].map(([contactId, entry]) => (
        <View key={contactId} className="gap-1.5 rounded-lg border border-neutral-200 bg-white p-3">
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 font-semibold text-neutral-900" numberOfLines={1}>
              {entry.name}
            </Text>
            <Text className="font-semibold text-neutral-900">{formatCurrency(entry.total)}</Text>
          </View>
          {entry.rows.map((row) => (
            <View key={row.accountId} className="flex-row items-center justify-between">
              <Text className="flex-1 text-xs text-neutral-500" numberOfLines={1}>
                {row.accountName}
              </Text>
              <Text className="text-xs text-neutral-500">{formatCurrency(row.remaining)}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
