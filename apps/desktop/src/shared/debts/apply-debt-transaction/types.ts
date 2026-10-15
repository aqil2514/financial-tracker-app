import type { getDb } from "@/lib/db";

export type Db = Awaited<ReturnType<typeof getDb>>;

export type TouchedDebtRows = {
  debtIds: string[];
  debtPaymentIds: string[];
  deletedDebtIds: string[];
  deletedDebtPaymentIds: string[];
};

export function mergeTouchedDebtRows(a: TouchedDebtRows, b: TouchedDebtRows): TouchedDebtRows {
  return {
    debtIds: [...a.debtIds, ...b.debtIds],
    debtPaymentIds: [...a.debtPaymentIds, ...b.debtPaymentIds],
    deletedDebtIds: [...a.deletedDebtIds, ...b.deletedDebtIds],
    deletedDebtPaymentIds: [...a.deletedDebtPaymentIds, ...b.deletedDebtPaymentIds],
  };
}
