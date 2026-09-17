import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
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
    <PageContainer>
      <PageHeader title="Laporan" description="Analisis dan tren keuangan Anda" />

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
    </PageContainer>
  );
}
