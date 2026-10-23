export type RetailkuPurchaseOrderSupplier = {
  id: string;
  name: string;
  code: string;
};

export type RetailkuPurchaseOrderListItemProduct = {
  id: string;
  name: string;
  sku: string;
};

export type RetailkuPurchaseOrderListItemLine = {
  id: string;
  itemName: string | null;
  quantity: number;
  purchaseUnitName: string;
  product: RetailkuPurchaseOrderListItemProduct | null;
  material: RetailkuPurchaseOrderListItemProduct | null;
};

export type RetailkuPurchaseOrderListItem = {
  id: string;
  number: string;
  status: "DRAFT" | "SENT" | "CANCELLED" | "COMPLETED";
  orderDate: string;
  totalAmount: number;
  outstandingAmount: number;
  notes: string;
  supplier: RetailkuPurchaseOrderSupplier;
  createdBy: { id: string; name: string };
  createdAt: string;
  items: RetailkuPurchaseOrderListItemLine[];
};

export type RetailkuPurchaseOrderList = {
  data: RetailkuPurchaseOrderListItem[];
  meta: {
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
};

export type RetailkuPurchaseOrderListItemRaw = Omit<
  RetailkuPurchaseOrderListItem,
  "totalAmount" | "outstandingAmount"
> & {
  totalAmount: string;
  outstandingAmount: string;
};

export type RetailkuPurchaseOrderListRaw = Omit<RetailkuPurchaseOrderList, "data"> & {
  data: RetailkuPurchaseOrderListItemRaw[];
};
