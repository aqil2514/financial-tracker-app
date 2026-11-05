import { Pressable, Text, View } from "react-native";

interface SegmentedControlProps<T extends string | number> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View className="flex-row self-start overflow-hidden rounded-md border border-neutral-300">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            className={isActive ? "bg-neutral-900 px-3 py-2" : "px-3 py-2"}
            onPress={() => onChange(option.value)}
          >
            <Text className={isActive ? "text-white" : "text-neutral-900"}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
