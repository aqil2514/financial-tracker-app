import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { callToolAsJson } from "./call-tool-as-json";

export type RetailkuFundTransferAccount = {
  id: string;
  code: string;
  name: string;
};

export type RetailkuFundTransferDetail = {
  id: string;
  transactionDate: string;
  description: string | null;
  transferAmount: number;
  fromFee: number;
  toFee: number;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  fromAccount: RetailkuFundTransferAccount;
  toAccount: RetailkuFundTransferAccount;
};

/** Panggil tool `get_fund_transfer_detail` — detail transfer dana antar
 * akun Retailku, dengan `fromAccount`/`toAccount` EKSPLISIT (id/code/
 * name) sehingga tidak perlu pairing manual dari `journal_items` mentah
 * (lihat docs/todos/plan/retailku-dynamic-sourcetype-mapping.md).
 * Verifikasi bentuk respons: dipanggil langsung ke toko nyata "Warung
 * Aqil" (`TRF-260919-01`, id `8286ce6c-2f26-4d03-aa04-14ecc23060df`),
 * 2026-09-27. Field `transferAmount`/`fromFee`/`toFee` datang sbg
 * string dari server (representasi desimal), dikonversi ke `number`
 * di sini. */
export async function getFundTransferDetail(client: Client, id: string): Promise<RetailkuFundTransferDetail> {
  const raw = await callToolAsJson<{
    id: string;
    transactionDate: string;
    description: string | null;
    transferAmount: string;
    fromFee: string;
    toFee: string;
    status: "DRAFT" | "POSTED" | "CANCELLED";
    fromAccount: RetailkuFundTransferAccount;
    toAccount: RetailkuFundTransferAccount;
  }>(client, "get_fund_transfer_detail", { id });

  return {
    id: raw.id,
    transactionDate: raw.transactionDate,
    description: raw.description,
    transferAmount: Number(raw.transferAmount),
    fromFee: Number(raw.fromFee),
    toFee: Number(raw.toFee),
    status: raw.status,
    fromAccount: raw.fromAccount,
    toAccount: raw.toAccount,
  };
}
