export type DetailField = {
  label: string;
  value: string;
};

export type DetailAdapterResult = {
  amount: string;
  note?: string;
  fields: DetailField[];
};

export type DetailAdapter<T = unknown> = (raw: T) => DetailAdapterResult;
