import { Stack, useRouter } from "expo-router";
import { View } from "react-native";
import { ContactSummaryList } from "@/features/debts/content/contact-summary-list";
import { useContactSummary } from "@/features/debts/content/use-contact-summary";

export default function DebtsSummaryPage() {
  const router = useRouter();
  const { summary, isLoading } = useContactSummary();

  return (
    <>
      <Stack.Screen options={{ title: "Ringkasan Kontak" }} />
      <View className="flex-1 bg-white">
        <ContactSummaryList
          summary={summary}
          isLoading={isLoading}
          onPressContact={(contactId) =>
            router.push({ pathname: "/debts/contact/[id]", params: { id: contactId } })
          }
        />
      </View>
    </>
  );
}
