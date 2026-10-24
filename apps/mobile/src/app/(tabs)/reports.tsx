import { Dimensions, ScrollView, View } from "react-native";
import { BarChart } from "react-native-chart-kit";
import { PageHeader } from "@/components/page-header";

const screenWidth = Dimensions.get("window").width;

const chartData = {
  labels: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun"],
  datasets: [{ data: [1200, 900, 1500, 800, 2000, 1700] }],
};

const chartConfig = {
  backgroundGradientFrom: "#ffffff",
  backgroundGradientTo: "#ffffff",
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(22, 163, 74, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(23, 23, 23, ${opacity})`,
};

export default function ReportsPage() {
  return (
    <View className="flex-1 bg-white">
      <PageHeader title="Laporan" />
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        <BarChart
          data={chartData}
          width={screenWidth - 32}
          height={220}
          yAxisLabel="Rp"
          yAxisSuffix="rb"
          chartConfig={chartConfig}
          fromZero
        />
      </ScrollView>
    </View>
  );
}
