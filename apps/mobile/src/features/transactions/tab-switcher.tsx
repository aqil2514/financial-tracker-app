import { Pressable, Text, View } from "react-native";

export type TransactionTab = "daily" | "calendar";

const TABS: { key: TransactionTab; label: string }[] = [
  { key: "daily", label: "Harian" },
  { key: "calendar", label: "Kalender" },
];

interface TabSwitcherProps {
  active: TransactionTab;
  onChange: (tab: TransactionTab) => void;
}

export function TransactionTabSwitcher({ active, onChange }: TabSwitcherProps) {
  return (
    <View className="flex-row border-b border-neutral-200 px-4">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            className={`mr-6 border-b-2 py-2 ${isActive ? "border-neutral-900" : "border-transparent"}`}
            onPress={() => onChange(tab.key)}
          >
            <Text className={`font-medium ${isActive ? "text-neutral-900" : "text-neutral-400"}`}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
