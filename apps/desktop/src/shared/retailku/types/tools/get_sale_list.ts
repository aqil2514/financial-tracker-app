export type RetailkuSaleCustomer = {
  name: string;
};

export type RetailkuSaleListItemLine = {
  productName: string;
  quantity: number;
  unitName: string | null;
};

export type RetailkuSaleListItem = {
  id: string;
  number: string;
  status: "POSTED" | "CANCELLED";
  transactionDate: string;
  totalAmount: number;
  totalCogs: number;
  outstandingAmount: number;
  customer: RetailkuSaleCustomer | null;
  items: RetailkuSaleListItemLine[];
  saleReturns: unknown[];
  createdBy: { id: string; name: string };
};

export type RetailkuSaleList = {
  data: RetailkuSaleListItem[];
  meta: {
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
};

export type RetailkuSaleListItemRaw = Omit<
  RetailkuSaleListItem,
  "totalAmount" | "totalCogs" | "outstandingAmount"
> & {
  totalAmount: string;
  totalCogs: string;
  outstandingAmount: string;
};

export type RetailkuSaleListRaw = Omit<RetailkuSaleList, "data"> & {
  data: RetailkuSaleListItemRaw[];
};
