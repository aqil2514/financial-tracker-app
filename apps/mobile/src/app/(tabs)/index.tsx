import { View } from "react-native";
import { PageHeader } from "@/components/page-header";

export default function HomePage() {
  return (
    <View className="flex-1 bg-white">
      <PageHeader title="Beranda" />
    </View>
  );
}
