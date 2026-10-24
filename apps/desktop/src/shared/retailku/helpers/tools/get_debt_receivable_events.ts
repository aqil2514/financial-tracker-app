import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type {
  RetailkuDebtReceivableEventsResult,
  RetailkuDebtReceivableEventsResultRaw,
  RetailkuDebtReceivableKind,
  RetailkuDebtReceivableTrade,
  RetailkuDebtReceivableType,
} from "../../types/tools/get_debt_receivable_events";
import { callToolAsJson } from "./call-tool-as-json";
import { isWithinWibDayRange } from "./wib-date-range";

export async function getDebtReceivableEvents(
  client: Client,
  args: {
    dateFrom: string;
    dateTo: string;
    type?: RetailkuDebtReceivableType;
    trade?: RetailkuDebtReceivableTrade;
    kind?: RetailkuDebtReceivableKind;
    page?: number;
    limit?: number;
  }
): Promise<RetailkuDebtReceivableEventsResult> {
  const raw = await callToolAsJson<RetailkuDebtReceivableEventsResultRaw>(client, "get_debt_receivable_events", args);

  // Mitigasi sama seperti `get_sale_list` (lihat `registry/README.md` bagian `get-sale.ts`) —
  // belum dikonfirmasi tool ini kena bug timezone yang sama, tapi filter ulang manual ini
  // murah dan tanpa efek samping kalau datanya memang sudah benar.
  const data = raw.data
    .map((item) => ({ ...item, amount: Number(item.amount) }))
    .filter((item) => isWithinWibDayRange(item.date, args.dateFrom, args.dateTo));

  return { data, meta: raw.meta };
}
