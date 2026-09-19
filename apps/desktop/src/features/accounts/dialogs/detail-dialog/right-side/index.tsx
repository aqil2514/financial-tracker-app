"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AccountWithBalance } from "../../../calculate-balance";
import { useAccountDetail, type AccountDetailTab } from "../detail-context";
import { RecentTab } from "./recent-tab";
import { MonthTab } from "./month-tab";
import { DetailTab } from "./detail-tab";

const PANEL_HEIGHT = "h-[420px]";

/** Tab konten sisi kanan dialog detail akun — "Terbaru" dan "Bulan Ini"
 * menampilkan daftar transaksi (klik salah satu untuk melihat detailnya),
 * "Detail" menampilkan transaksi yang dipilih dari kedua tab tersebut.
 * Tab dikontrol lewat context (bukan defaultValue) supaya klik transaksi
 * bisa memindahkan tab aktif ke Detail secara otomatis. */
export function RightSide({ account }: { account: AccountWithBalance }) {
  const { activeTab, setActiveTab } = useAccountDetail();

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as AccountDetailTab)}
      className="h-full"
    >
      <TabsList>
        <TabsTrigger value="recent">Terbaru</TabsTrigger>
        <TabsTrigger value="month">Bulan Ini</TabsTrigger>
        <TabsTrigger value="detail">Detail</TabsTrigger>
      </TabsList>

      <TabsContent value="recent">
        <ScrollArea className={PANEL_HEIGHT}>
          <div className="pr-4">
            <RecentTab accountId={account.id} />
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="month">
        <ScrollArea className={PANEL_HEIGHT}>
          <div className="pr-4">
            <MonthTab accountId={account.id} />
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="detail">
        <ScrollArea className={PANEL_HEIGHT}>
          <div className="pr-4">
            <DetailTab />
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}
