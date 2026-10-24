import { getCashOpnameEntry } from "./get-cash-opname";
import { getPurchaseOrderEntry } from "./get-purchase-order";
import { getDirectPurchaseEntry } from "./get-direct-purchase";
import { getSaleEntry } from "./get-sale";
import { getFundTransferEntry } from "./get-fund-transfer";
import { getInvestmentEntry } from "./get-investment";
import { getDebtReceivableEventsEntry } from "./get-debt-receivable-events";
import type { RetailkuToolEntry } from "./types";

export const RETAILKU_TOOLS: Record<string, RetailkuToolEntry> = {
  get_cash_opname_list: getCashOpnameEntry,
  get_purchase_order_list: getPurchaseOrderEntry,
  get_direct_purchase_list: getDirectPurchaseEntry,
  get_sale_list: getSaleEntry,
  get_fund_transfer_list: getFundTransferEntry,
  get_investment_list: getInvestmentEntry,
  get_debt_receivable_events: getDebtReceivableEventsEntry,
};

export type {
  RetailkuToolEntry,
  RetailkuItemToolEntry,
  RetailkuSummaryToolEntry,
  RetailkuToolDateRange,
} from "./types";
