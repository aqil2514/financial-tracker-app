import {
  assertRetailkuConfigured,
  connectRetailkuMcp,
  getArAp,
  RetailkuArAp,
  useRetailkuSettings,
} from "@/shared/retailku";
import { useQuery } from "@tanstack/react-query";

export function useRetailkuArAp() {
  const { data: settings } = useRetailkuSettings();
  const isConfigured = !!settings?.mcpUrl && !!settings?.apiKey;

  return useQuery({
    queryKey: ["retailku", "ar-ap"],
    queryFn: async (): Promise<RetailkuArAp> => {
      const config = assertRetailkuConfigured(settings!);
      const client = await connectRetailkuMcp(config);
      try {
        return await getArAp(client);
      } finally {
        await client.close();
      }
    },
    enabled: isConfigured,
  });
}
