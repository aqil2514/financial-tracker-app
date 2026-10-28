import { Pressable, View } from "react-native";

export function AccountStatusDot({
  isActive,
  onToggle,
}: {
  isActive: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} hitSlop={10} className="p-1">
      <View
        className={`size-2.5 shrink-0 rounded-full ${isActive ? "bg-emerald-500" : "bg-neutral-300"}`}
      />
    </Pressable>
  );
}
