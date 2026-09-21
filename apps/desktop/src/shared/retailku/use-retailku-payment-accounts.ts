"use client";

import { useQuery } from "@tanstack/react-query";

import { assertRetailkuConfigured, connectRetailkuMcp } from "./mcp-connection";
import { getFinanceAccounts, type RetailkuFinanceAccount } from "./mcp-tools";
import { useRetailkuSettings } from "./use-retailku-settings";

export const retailkuPaymentAccountsQueryKey = ["retailku", "payment-accounts"];

/**
 * Akun Retailku yang relevan untuk mapping ke akun `financial-app` —
 * cuma yang `isPaymentMethod: true` (akun kas/bank/e-wallet ASLI, bukan
 * akun akuntansi murni seperti HPP/Persediaan/Piutang). Lihat "Kebutuhan
 * skema baru untuk integrasi ini" di debt-receivable-tracking.md.
 *
 * Query ini membuka+menutup koneksi MCP setiap kali dipanggil (bukan
 * koneksi persisten) — wajar untuk kebutuhan setup mapping yang jarang
 * dipanggil, bukan sync berulang.
 */
export function useRetailkuPaymentAccounts() {
  const { data: settings } = useRetailkuSettings();
  const isConfigured = !!settings?.mcpUrl && !!settings?.apiKey;

  return useQuery({
    queryKey: retailkuPaymentAccountsQueryKey,
    queryFn: async (): Promise<RetailkuFinanceAccount[]> => {
      const config = assertRetailkuConfigured(settings!);
      const client = await connectRetailkuMcp(config);
      try {
        const accounts = await getFinanceAccounts(client);
        return accounts.filter((account) => account.isPaymentMethod);
      } finally {
        await client.close();
      }
    },
    enabled: isConfigured,
  });
}
