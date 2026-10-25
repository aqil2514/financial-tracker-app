import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Pressable, Text, View } from "react-native";

export interface FilterTextInputProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  onClear?: () => void;
}

export function FilterTextInput({
  onValueChange,
  value,
  clearable,
  disabled,
  onClear,
  placeholder = "Masukkan nilai",
}: FilterTextInputProps) {
  return (
    <View className="flex-row items-center gap-1">
      <BottomSheetTextInput
        value={value}
        editable={!disabled}
        className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-neutral-900"
        placeholder={placeholder}
        onChangeText={onValueChange}
      />
      {clearable && (
        <Pressable
          className="rounded-md border border-neutral-300 px-3 py-2"
          onPress={onClear}
        >
          <Text className="text-neutral-900">×</Text>
        </Pressable>
      )}
    </View>
  );
}
