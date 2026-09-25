import { assertRetailkuConfigured, connectRetailkuMcp, getCashflowSummary, RetailkuCashflowSummary, useRetailkuSettings } from "@/shared/retailku";
import { CashflowDateRange } from "../summary-context";
import { useQuery } from "@tanstack/react-query";

export function useRetailkuCashflowSummary(range: CashflowDateRange) {
  const { data: settings } = useRetailkuSettings();
  const isConfigured = !!settings?.mcpUrl && !!settings?.apiKey;

  return useQuery({
    queryKey: ["retailku", "cashflow-summary", range],
    queryFn: async (): Promise<RetailkuCashflowSummary> => {
      const config = assertRetailkuConfigured(settings!);
      const client = await connectRetailkuMcp(config);
      try {
        return await getCashflowSummary(client, range);
      } finally {
        await client.close();
      }
    },
    enabled: isConfigured,
  });
}