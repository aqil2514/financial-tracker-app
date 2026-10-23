import type { RetailkuSaleCustomer } from "./get_sale_list";

export type RetailkuSaleProductType =
  | "MERCHANDISE"
  | "PPOB"
  | "MANUFACTURE"
  | "SERVICE"
  | "CONSIGNMENT"
  | "RAW_MATERIAL";

export type RetailkuSaleDetailItem = {
  id: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitName: string | null;
  baseQuantity: number;
  basePrice: number;
  unitPrice: number;
  unitCost: number;
  totalPrice: number;
  totalCost: number;
  bundleId: string | null;
  bundle: { id: string; name: string } | null;
  product: { type: RetailkuSaleProductType; providerId: string | null } | null;
};

export type RetailkuSalePaymentLineAccount = {
  id: string;
  name: string;
  code: string;
};

export type RetailkuSalePaymentLine = {
  id: string;
  amount: number;
  feeAmount: number;
  account: RetailkuSalePaymentLineAccount;
};

export type RetailkuSalePaymentItem = {
  amount: number;
  account: RetailkuSalePaymentLineAccount;
};

export type RetailkuSalePayment = {
  id: string;
  number: string;
  type: "PARTIAL" | "SETTLEMENT";
  paymentDate: string;
  totalAmount: number;
  items: RetailkuSalePaymentItem[];
};

export type RetailkuSaleJournalEntry = {
  id: string;
  number: string;
  reference: string | null;
  status: string;
};

export type RetailkuSaleReturnRefundLine = {
  id: string;
  amount: number;
  account: RetailkuSalePaymentLineAccount;
};

export type RetailkuSaleReturn = {
  id: string;
  number: string;
  status: "DRAFT" | "VERIFIED" | "CANCELLED";
  returnDate: string;
  totalAmount: number;
  refundLines: RetailkuSaleReturnRefundLine[];
};

export type RetailkuSaleDetail = {
  id: string;
  number: string;
  status: "POSTED" | "CANCELLED";
  transactionDate: string;
  notes: string | null;
  discountAmount: number;
  discountPct: number;
  totalAmount: number;
  totalCogs: number;
  totalPaid: number;
  outstandingAmount: number;
  createdAt: string;
  cancelledAt: string | null;
  items: RetailkuSaleDetailItem[];
  paymentLines: RetailkuSalePaymentLine[];
  journalEntry: RetailkuSaleJournalEntry | null;
  customer: RetailkuSaleCustomer | null;
  saleReturns: RetailkuSaleReturn[];
  salePayments: RetailkuSalePayment[];
  createdBy: { id: string; name: string };
};

const saleDetailNumericItemKeys = [
  "basePrice",
  "unitPrice",
  "unitCost",
  "totalPrice",
  "totalCost",
] as const;

export type RetailkuSaleDetailItemRaw = Omit<
  RetailkuSaleDetailItem,
  (typeof saleDetailNumericItemKeys)[number]
> & {
  basePrice: string;
  unitPrice: string;
  unitCost: string;
  totalPrice: string;
  totalCost: string;
};

export type RetailkuSalePaymentLineRaw = Omit<RetailkuSalePaymentLine, "amount" | "feeAmount"> & {
  amount: string;
  feeAmount: string;
};

export type RetailkuSalePaymentItemRaw = Omit<RetailkuSalePaymentItem, "amount"> & {
  amount: string;
};

export type RetailkuSalePaymentRaw = Omit<RetailkuSalePayment, "totalAmount" | "items"> & {
  totalAmount: string;
  items: RetailkuSalePaymentItemRaw[];
};

export type RetailkuSaleReturnRefundLineRaw = Omit<RetailkuSaleReturnRefundLine, "amount"> & {
  amount: string;
};

export type RetailkuSaleReturnRaw = Omit<RetailkuSaleReturn, "totalAmount" | "refundLines"> & {
  totalAmount: string;
  refundLines: RetailkuSaleReturnRefundLineRaw[];
};

export type RetailkuSaleDetailRaw = Omit<
  RetailkuSaleDetail,
  | "discountAmount"
  | "discountPct"
  | "totalAmount"
  | "totalCogs"
  | "totalPaid"
  | "outstandingAmount"
  | "items"
  | "paymentLines"
  | "saleReturns"
  | "salePayments"
> & {
  discountAmount: string;
  discountPct: string;
  totalAmount: string;
  totalCogs: string;
  totalPaid: string;
  outstandingAmount: string;
  items: RetailkuSaleDetailItemRaw[];
  paymentLines: RetailkuSalePaymentLineRaw[];
  saleReturns: RetailkuSaleReturnRaw[];
  salePayments: RetailkuSalePaymentRaw[];
};
