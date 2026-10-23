import type { RetailkuDirectPurchaseSupplier } from "./get_direct_purchase_list";

export type RetailkuDirectPurchaseDetailProduct = {
  id: string;
  name: string;
  sku: string;
};

export type RetailkuDirectPurchaseDetailItem = {
  id: string;
  itemType: "STOCK" | "SUPPLY" | "ASSET" | "RAW_MATERIAL";
  itemName: string | null;
  quantity: number;
  purchaseUnitName: string;
  purchaseUnitValue: string;
  conversionToBase: number;
  baseQuantity: number;
  unitPrice: number;
  discountType: string | null;
  discountValue: number | null;
  discountAmount: number;
  subtotal: number;
  netTotal: number;
  costAdjustmentAllocation: number;
  inventoryCostAmount: number;
  notes: string | null;
  product: RetailkuDirectPurchaseDetailProduct | null;
  material: RetailkuDirectPurchaseDetailProduct | null;
};

export type RetailkuDirectPurchaseAdjustment = {
  id: string;
  type: string;
  label: string;
  amount: number;
  direction: "ADD" | "SUBTRACT";
  affectsInventoryCost: boolean;
};

export type RetailkuDirectPurchasePaymentAccount = {
  id: string;
  name: string;
  code: string;
};

export type RetailkuDirectPurchasePaymentLine = {
  id: string;
  amount: number;
  notes: string | null;
  account: RetailkuDirectPurchasePaymentAccount;
};

export type RetailkuDirectPurchaseJournalEntry = {
  id: string;
  reference: string;
  status: string;
};

export type RetailkuDirectPurchaseDetail = {
  id: string;
  number: string;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  purchaseDate: string;
  notes: string | null;
  subtotalAmount: number;
  itemDiscountAmount: number;
  adjustmentAmount: number;
  totalAmount: number;
  totalPaid: number;
  outstandingAmount: number;
  createdAt: string;
  supplier: RetailkuDirectPurchaseSupplier;
  items: RetailkuDirectPurchaseDetailItem[];
  adjustments: RetailkuDirectPurchaseAdjustment[];
  paymentLines: RetailkuDirectPurchasePaymentLine[];
  journalEntry: RetailkuDirectPurchaseJournalEntry | null;
  createdBy: { id: string; name: string };
};

const directPurchaseDetailNumericItemKeys = [
  "conversionToBase",
  "baseQuantity",
  "unitPrice",
  "discountValue",
  "discountAmount",
  "subtotal",
  "netTotal",
  "costAdjustmentAllocation",
  "inventoryCostAmount",
] as const;

export type RetailkuDirectPurchaseDetailItemRaw = Omit<
  RetailkuDirectPurchaseDetailItem,
  (typeof directPurchaseDetailNumericItemKeys)[number]
> & {
  conversionToBase: string;
  baseQuantity: string;
  unitPrice: string;
  discountValue: string | null;
  discountAmount: string;
  subtotal: string;
  netTotal: string;
  costAdjustmentAllocation: string;
  inventoryCostAmount: string;
};

export type RetailkuDirectPurchaseAdjustmentRaw = Omit<RetailkuDirectPurchaseAdjustment, "amount"> & {
  amount: string;
};

export type RetailkuDirectPurchasePaymentLineRaw = Omit<RetailkuDirectPurchasePaymentLine, "amount"> & {
  amount: string;
};

export type RetailkuDirectPurchaseDetailRaw = Omit<
  RetailkuDirectPurchaseDetail,
  | "subtotalAmount"
  | "itemDiscountAmount"
  | "adjustmentAmount"
  | "totalAmount"
  | "totalPaid"
  | "outstandingAmount"
  | "items"
  | "adjustments"
  | "paymentLines"
> & {
  subtotalAmount: string;
  itemDiscountAmount: string;
  adjustmentAmount: string;
  totalAmount: string;
  totalPaid: string;
  outstandingAmount: string;
  items: RetailkuDirectPurchaseDetailItemRaw[];
  adjustments: RetailkuDirectPurchaseAdjustmentRaw[];
  paymentLines: RetailkuDirectPurchasePaymentLineRaw[];
};
