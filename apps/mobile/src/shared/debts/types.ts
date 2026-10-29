import type { SQLiteDatabase } from "expo-sqlite";

export type Db = SQLiteDatabase;

export type TouchedDebtRows = {
  debtIds: string[];
  debtPaymentIds: string[];
  deletedDebtIds: string[];
  deletedDebtPaymentIds: string[];
};

export const NO_TOUCHED_DEBT_ROWS: TouchedDebtRows = {
  debtIds: [],
  debtPaymentIds: [],
  deletedDebtIds: [],
  deletedDebtPaymentIds: [],
};

export function mergeTouchedDebtRows(a: TouchedDebtRows, b: TouchedDebtRows): TouchedDebtRows {
  return {
    debtIds: [...a.debtIds, ...b.debtIds],
    debtPaymentIds: [...a.debtPaymentIds, ...b.debtPaymentIds],
    deletedDebtIds: [...a.deletedDebtIds, ...b.deletedDebtIds],
    deletedDebtPaymentIds: [...a.deletedDebtPaymentIds, ...b.deletedDebtPaymentIds],
  };
}
