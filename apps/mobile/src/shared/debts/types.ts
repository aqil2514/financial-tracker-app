import type { SQLiteDatabase } from "expo-sqlite";

export type Db = SQLiteDatabase;

export type TouchedDebtRows = {
  debtIds: string[];
  debtPaymentIds: string[];
};

export const NO_TOUCHED_DEBT_ROWS: TouchedDebtRows = { debtIds: [], debtPaymentIds: [] };
