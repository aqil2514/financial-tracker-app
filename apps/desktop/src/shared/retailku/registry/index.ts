import { getCashOpnameEntry } from "./get-cash-opname";
import type { RetailkuToolEntry } from "./types";

export const RETAILKU_TOOLS: Record<string, RetailkuToolEntry> = {
  get_cash_opname_list: getCashOpnameEntry,
};

export type { RetailkuToolEntry, RetailkuToolDateRange } from "./types";
