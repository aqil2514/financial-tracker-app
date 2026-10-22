import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { callToolAsJson } from "./call-tool-as-json";

/** Satu baris chart of accounts Retailku — bentuk field dikonfirmasi
 * lewat panggilan nyata ke MCP "Warung Aqil" (lihat
 * docs/todos/plan/retailku-integration.md). `isPaymentMethod: true`
 * secara eksplisit memisahkan akun kas/bank/e-wallet ASLI (tempat uang
 * benar-benar disimpan) dari akun akuntansi murni (HPP, Persediaan,
 * Piutang, dst) — cuma akun `isPaymentMethod` yang relevan untuk
 * mapping ke akun `financial-app`. */
export type RetailkuFinanceAccount = {
  id: string;
  code: string;
  name: string;
  category: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  normalBalance: "DEBIT" | "CREDIT";
  isHeader: boolean;
  isPaymentMethod: boolean;
  isTrackedAsset: boolean;
  isInvestmentAccount: boolean;
  parentId: string | null;
  accountMappings: { role: string }[];
};

/** Panggil tool `get_finance_accounts`. */
export async function getFinanceAccounts(client: Client): Promise<RetailkuFinanceAccount[]> {
  return callToolAsJson<RetailkuFinanceAccount[]>(client, "get_finance_accounts");
}
