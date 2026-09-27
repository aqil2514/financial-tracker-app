import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { callToolAsJson } from "./call-tool-as-json";
import type { RetailkuFundTransferAccount } from "./get-fund-transfer-detail";

export type RetailkuFundTransferListItem = {
  id: string;
  number: string;
  transactionDate: string;
  description: string | null;
  transferAmount: number;
  fromFee: number;
  toFee: number;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  fromAccount: RetailkuFundTransferAccount;
  toAccount: RetailkuFundTransferAccount;
};

export type RetailkuFundTransferList = {
  data: RetailkuFundTransferListItem[];
  total: number;
  page: number;
  limit: number;
};

/** Panggil tool `get_fund_transfer_list` — daftar transfer dana antar
 * akun Retailku dalam rentang tanggal, dengan pagination. BEDA bentuk
 * respons dari `get_cashflow_detail` (`{ data, meta: { pagination }}`)
 * — di sini top-level `{ data, total, page, limit }` langsung,
 * DIVERIFIKASI ke data nyata toko "Warung Aqil" 2026-09-27 (7 transfer,
 * `TRF-260926-01` dkk). `number` (mis. `"TRF-260926-01"`) adalah
 * identitas human-readable dokumen — dipakai sbg bagian key mapping,
 * BUKAN `id` (UUID), selaras pola `sourceRef` di jalur lain. Field
 * `transferAmount`/`fromFee`/`toFee` datang sbg string dari server,
 * dikonversi ke `number` di sini (sama seperti `getFundTransferDetail`). */
export async function getFundTransferList(
  client: Client,
  args: { dateFrom: string; dateTo: string; timezone?: string; status?: "DRAFT" | "POSTED" | "CANCELLED"; page?: number; limit?: number }
): Promise<RetailkuFundTransferList> {
  const raw = await callToolAsJson<{
    data: Array<{
      id: string;
      number: string;
      transactionDate: string;
      description: string | null;
      transferAmount: string;
      fromFee: string;
      toFee: string;
      status: "DRAFT" | "POSTED" | "CANCELLED";
      fromAccount: RetailkuFundTransferAccount;
      toAccount: RetailkuFundTransferAccount;
    }>;
    total: number;
    page: number;
    limit: number;
  }>(client, "get_fund_transfer_list", args);

  return {
    data: raw.data.map((item) => ({
      id: item.id,
      number: item.number,
      transactionDate: item.transactionDate,
      description: item.description,
      transferAmount: Number(item.transferAmount),
      fromFee: Number(item.fromFee),
      toFee: Number(item.toFee),
      status: item.status,
      fromAccount: item.fromAccount,
      toAccount: item.toAccount,
    })),
    total: raw.total,
    page: raw.page,
    limit: raw.limit,
  };
}
