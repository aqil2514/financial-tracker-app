import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  MonthlySummaryChart,
  CategoryBreakdownChart,
  AccountBalanceChart,
} from "@/features/reports";

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Laporan</h1>

      <Tabs defaultValue="monthly">
        <TabsList>
          <TabsTrigger value="monthly">Ringkasan Bulanan</TabsTrigger>
          <TabsTrigger value="category">Per Kategori</TabsTrigger>
          <TabsTrigger value="account">Per Akun</TabsTrigger>
        </TabsList>
        <TabsContent value="monthly">
          <MonthlySummaryChart />
        </TabsContent>
        <TabsContent value="category">
          <CategoryBreakdownChart />
        </TabsContent>
        <TabsContent value="account">
          <AccountBalanceChart />
        </TabsContent>
      </Tabs>
    </div>
  );
}
