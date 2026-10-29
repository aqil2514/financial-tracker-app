import { FlatList, Text, View } from "react-native";
import type { ContactDebtSummary } from "@/shared/debts";
import { ContactSummaryCard } from "./contact-summary-card";

export function ContactSummaryList({
  summary,
  isLoading,
  onPressContact,
}: {
  summary: ContactDebtSummary[];
  isLoading: boolean;
  onPressContact: (contactId: string) => void;
}) {
  if (!isLoading && summary.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-center text-neutral-500">
          Belum ada kontak yang punya piutang/utang tercatat.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={summary}
      keyExtractor={(item) => item.contact_id}
      contentContainerClassName="gap-3 p-4"
      renderItem={({ item }) => (
        <ContactSummaryCard contact={item} onPress={() => onPressContact(item.contact_id)} />
      )}
    />
  );
}
