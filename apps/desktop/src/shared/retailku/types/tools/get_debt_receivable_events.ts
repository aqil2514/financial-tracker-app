export type RetailkuDebtReceivableKind = "ISSUED" | "SETTLED";
export type RetailkuDebtReceivableType = "RECEIVABLE" | "PAYABLE";
export type RetailkuDebtReceivableTrade = "TRADE" | "NON_TRADE";

export type RetailkuDebtReceivableEvent = {
  id: string;
  kind: RetailkuDebtReceivableKind;
  source: string;
  trade: RetailkuDebtReceivableTrade;
  type: RetailkuDebtReceivableType;
  partyName: string | null;
  description: string;
  date: string;
  amount: number;
  relatedDocumentId: string | null;
  relatedDocumentNumber: string | null;
};

export type RetailkuDebtReceivableEventsResult = {
  data: RetailkuDebtReceivableEvent[];
  meta: {
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
};

export type RetailkuDebtReceivableEventRaw = Omit<RetailkuDebtReceivableEvent, "amount"> & {
  amount: string | number;
};

export type RetailkuDebtReceivableEventsResultRaw = Omit<RetailkuDebtReceivableEventsResult, "data"> & {
  data: RetailkuDebtReceivableEventRaw[];
};
