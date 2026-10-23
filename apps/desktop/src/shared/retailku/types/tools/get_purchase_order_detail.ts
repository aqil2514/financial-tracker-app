import type { RetailkuPurchaseOrderListItemProduct, RetailkuPurchaseOrderSupplier } from "./get_purchase_order_list";

export type RetailkuPurchaseOrderDetailItem = {
  id: string;
  itemType: "STOCK" | "SUPPLY" | "ASSET" | "RAW_MATERIAL";
  productId: string | null;
  itemName: string | null;
  quantity: number;
  purchaseUnitId: string;
  purchaseUnitName: string;
  purchaseUnitValue: string;
  conversionToBase: number;
  baseQuantity: number;
  unitPrice: number;
  subtotal: number;
  discountType: string | null;
  discountValue: number | null;
  discountAmount: number;
  netTotal: number;
  costAdjustmentAllocation: number;
  totalPrice: number;
  receivedQuantity: number;
  notes: string | null;
  product: RetailkuPurchaseOrderListItemProduct | null;
  material: RetailkuPurchaseOrderListItemProduct | null;
};

export type RetailkuPurchaseOrderAdjustment = {
  id: string;
  type: string;
  label: string;
  amount: number;
  direction: "ADD" | "SUBTRACT";
};

export type RetailkuPurchaseOrderPaymentAccount = {
  id: string;
  code: string;
  name: string;
};

export type RetailkuPurchaseOrderPaymentLine = {
  id: string;
  accountId: string;
  amount: number;
  notes: string | null;
  account: RetailkuPurchaseOrderPaymentAccount;
};

export type RetailkuPurchaseOrderPayment = {
  id: string;
  number: string;
  type: "DOWN_PAYMENT" | "SETTLEMENT";
  status: "DRAFT" | "POSTED" | "CANCELLED";
  paymentDate: string;
  totalAmount: number;
  appliedDownPayment: number;
  notes: string | null;
  lines: RetailkuPurchaseOrderPaymentLine[];
};

export type RetailkuPurchaseOrderDetail = {
  id: string;
  number: string;
  status: "DRAFT" | "SENT" | "CANCELLED" | "COMPLETED";
  orderDate: string;
  subtotalAmount: number;
  itemDiscountAmount: number;
  adjustmentAmount: number;
  totalAmount: number;
  totalPaid: number;
  totalDownPayment: number;
  outstandingAmount: number;
  notes: string;
  sentAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  supplier: RetailkuPurchaseOrderSupplier;
  adjustments: RetailkuPurchaseOrderAdjustment[];
  items: RetailkuPurchaseOrderDetailItem[];
  purchasePayments: RetailkuPurchaseOrderPayment[];
  createdBy: { id: string; name: string };
};

const purchaseOrderDetailNumericItemKeys = [
  "conversionToBase",
  "baseQuantity",
  "unitPrice",
  "subtotal",
  "discountValue",
  "discountAmount",
  "netTotal",
  "costAdjustmentAllocation",
  "totalPrice",
] as const;

export type RetailkuPurchaseOrderDetailItemRaw = Omit<
  RetailkuPurchaseOrderDetailItem,
  (typeof purchaseOrderDetailNumericItemKeys)[number]
> & {
  conversionToBase: string;
  baseQuantity: string;
  unitPrice: string;
  subtotal: string;
  discountValue: string | null;
  discountAmount: string;
  netTotal: string;
  costAdjustmentAllocation: string;
  totalPrice: string;
};

export type RetailkuPurchaseOrderAdjustmentRaw = Omit<RetailkuPurchaseOrderAdjustment, "amount"> & {
  amount: string;
};

export type RetailkuPurchaseOrderPaymentLineRaw = Omit<RetailkuPurchaseOrderPaymentLine, "amount"> & {
  amount: string;
};

export type RetailkuPurchaseOrderPaymentRaw = Omit<
  RetailkuPurchaseOrderPayment,
  "totalAmount" | "appliedDownPayment" | "lines"
> & {
  totalAmount: string;
  appliedDownPayment: string;
  lines: RetailkuPurchaseOrderPaymentLineRaw[];
};

export type RetailkuPurchaseOrderDetailRaw = Omit<
  RetailkuPurchaseOrderDetail,
  | "subtotalAmount"
  | "itemDiscountAmount"
  | "adjustmentAmount"
  | "totalAmount"
  | "totalPaid"
  | "totalDownPayment"
  | "outstandingAmount"
  | "adjustments"
  | "items"
  | "purchasePayments"
> & {
  subtotalAmount: string;
  itemDiscountAmount: string;
  adjustmentAmount: string;
  totalAmount: string;
  totalPaid: string;
  totalDownPayment: string;
  outstandingAmount: string;
  adjustments: RetailkuPurchaseOrderAdjustmentRaw[];
  items: RetailkuPurchaseOrderDetailItemRaw[];
  purchasePayments: RetailkuPurchaseOrderPaymentRaw[];
};
