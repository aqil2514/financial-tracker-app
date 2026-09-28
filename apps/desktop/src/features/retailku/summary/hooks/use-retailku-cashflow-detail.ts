import { assertRetailkuConfigured, connectRetailkuMcp, getCashflowDetail, RetailkuCashflowDetail, useRetailkuSettings } from "@/shared/retailku";
import { CashflowDateRange } from "../summary-context";
import { useQuery } from "@tanstack/react-query";

export function useRetailkuCashflowDetail(
  range: CashflowDateRange,
  page: number,
  limit: number = 20
) {
  const { data: settings } = useRetailkuSettings();
  const isConfigured = !!settings?.mcpUrl && !!settings?.apiKey;

  return useQuery({
    queryKey: ["retailku", "cashflow-detail", range, page, limit],
    queryFn: async (): Promise<RetailkuCashflowDetail> => {
      const config = assertRetailkuConfigured(settings!);
      const client = await connectRetailkuMcp(config);
      try {
        return await getCashflowDetail(client, { ...range, page, limit });
      } finally {
        await client.close();
      }
    },
    enabled: isConfigured,
  });
}