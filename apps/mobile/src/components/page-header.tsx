import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type PageHeaderProps = {
  title: string;
};

export function PageHeader({ title }: PageHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="border-b border-neutral-200 bg-white px-4 pb-3"
    >
      <Text className="text-2xl font-bold text-neutral-900">{title}</Text>
    </View>
  );
}
