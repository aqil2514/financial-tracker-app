import {
  assertRetailkuConfigured,
  connectRetailkuMcp,
  getCashflowAllocation,
  RetailkuCashflowAllocation,
  useRetailkuSettings,
} from "@/shared/retailku";
import { CashflowDateRange } from "../summary-context";
import { useQuery } from "@tanstack/react-query";

export function useRetailkuCashflowAllocation(range: CashflowDateRange) {
  const { data: settings } = useRetailkuSettings();
  const isConfigured = !!settings?.mcpUrl && !!settings?.apiKey;

  return useQuery({
    queryKey: ["retailku", "cashflow-allocation", range],
    queryFn: async (): Promise<RetailkuCashflowAllocation> => {
      const config = assertRetailkuConfigured(settings!);
      const client = await connectRetailkuMcp(config);
      try {
        return await getCashflowAllocation(client, range);
      } finally {
        await client.close();
      }
    },
    enabled: isConfigured,
  });
}
