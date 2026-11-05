import { Pressable, Text, View } from "react-native";

interface TabSwitcherProps<T extends string> {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (tab: T) => void;
}

export function TabSwitcher<T extends string>({ tabs, active, onChange }: TabSwitcherProps<T>) {
  return (
    <View className="flex-row border-b border-neutral-200 px-4">
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
    </View>
  );
}
