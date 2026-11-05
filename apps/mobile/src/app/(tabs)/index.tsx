import { View } from "react-native";
import { PageHeader } from "@/components/page-header";
import { DashboardContent } from "@/features/dashboard";

export default function HomePage() {
  return (
    <View className="flex-1 bg-white">
      <PageHeader title="Beranda" />
      <DashboardContent />
    </View>
  );
}
