import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { callToolAsJson } from "./call-tool-as-json";

export type RetailkuArApParty = {
  id: string;
  name: string;
  type: "CUSTOMER" | "SUPPLIER";
  outstandingReceivable: number;
  outstandingPayable: number;
  hasOpen: boolean;
};

export type RetailkuArAp = {
  parties: RetailkuArApParty[];
  totalReceivable: number;
  totalPayable: number;
};

/** Panggil tool `get_ar_ap` — snapshot piutang/utang outstanding SAAT
 * INI per pihak (bukan rentang tanggal, lihat
 * docs/todos/plan/retailku-cashflow-sync.md bagian "Keterkaitan dengan
 * sync utang-piutang"). Ditampilkan sebagai info tambahan read-only,
 * BELUM jadi sumber data sync (itu dokumen terpisah). */
export async function getArAp(client: Client, args: { type?: "CUSTOMER" | "SUPPLIER" } = {}): Promise<RetailkuArAp> {
  return callToolAsJson<RetailkuArAp>(client, "get_ar_ap", args);
}
