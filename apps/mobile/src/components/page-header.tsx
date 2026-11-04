import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type PageHeaderProps = {
  title: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, actions }: PageHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="flex-row items-center justify-between border-b border-neutral-200 bg-white px-4 pb-3"
    >
      {typeof title === "string" ? (
        <Text className="text-2xl font-bold text-neutral-900">{title}</Text>
      ) : (
        title
      )}
      {actions}
    </View>
  );
}
