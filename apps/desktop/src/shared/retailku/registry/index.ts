import { getCashOpnameEntry } from "./get-cash-opname";
import { getPurchaseOrderEntry } from "./get-purchase-order";
import { getDirectPurchaseEntry } from "./get-direct-purchase";
import { getSaleEntry } from "./get-sale";
import type { RetailkuToolEntry } from "./types";

export const RETAILKU_TOOLS: Record<string, RetailkuToolEntry> = {
  get_cash_opname_list: getCashOpnameEntry,
  get_purchase_order_list: getPurchaseOrderEntry,
  get_direct_purchase_list: getDirectPurchaseEntry,
  get_sale_list: getSaleEntry,
};

export type {
  RetailkuToolEntry,
  RetailkuItemToolEntry,
  RetailkuSummaryToolEntry,
  RetailkuToolDateRange,
} from "./types";
