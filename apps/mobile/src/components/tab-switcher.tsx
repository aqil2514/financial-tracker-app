import { Pressable, ScrollView, Text } from "react-native";

interface TabSwitcherProps<T extends string> {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (tab: T) => void;
}

// Bisa digeser ke samping supaya muat banyak tab dengan label panjang (mis. Laporan).
export function TabSwitcher<T extends string>({ tabs, active, onChange }: TabSwitcherProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="grow-0 shrink-0 border-b border-neutral-200"
      contentContainerClassName="px-4"
    >
      {tabs.map((tab) => {
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
    </ScrollView>
  );
}
