export type RetailkuDirectPurchaseSupplier = {
  id: string;
  name: string;
  code: string;
};

export type RetailkuDirectPurchaseListItem = {
  id: string;
  number: string;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  purchaseDate: string;
  totalAmount: number;
  totalPaid: number;
  outstandingAmount: number;
  createdAt: string;
  supplier: RetailkuDirectPurchaseSupplier;
  createdBy: { id: string; name: string };
};

export type RetailkuDirectPurchaseList = {
  data: RetailkuDirectPurchaseListItem[];
  meta: {
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
};

export type RetailkuDirectPurchaseListItemRaw = Omit<
  RetailkuDirectPurchaseListItem,
  "totalAmount" | "totalPaid" | "outstandingAmount"
> & {
  totalAmount: string;
  totalPaid: string;
  outstandingAmount: string;
};

export type RetailkuDirectPurchaseListRaw = Omit<RetailkuDirectPurchaseList, "data"> & {
  data: RetailkuDirectPurchaseListItemRaw[];
};
