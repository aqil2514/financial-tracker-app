import type { SQLiteDatabase } from "expo-sqlite";

import { getAverageCostPerUnit } from "./investment-holding-math";

type Db = SQLiteDatabase;

export type InvestmentAccountSummary = {
  id: string;
  name: string;
  groupName: string | null;
  isActive: boolean;
  unitLabel: string;
  balance: number;
  currentMarketValue: number;
  marketValueUpdatedAt: string | null;
};

export type InvestmentPurchaseRow = {
  id: string;
  date: string;
  unit: number | null;
  pricePerUnit: number | null;
  amount: number;
  status: "pending" | "settled";
  isDirect: boolean;
};

export type InvestmentSaleRow = {
  id: string;
  date: string;
  unit: number;
  pricePerUnit: number;
  averageCost: number | null;
  realizedPl: number | null;
  status: "pending" | "settled";
  isWriteOff: boolean;
};

export type InvestmentDetail = {
  account: InvestmentAccountSummary;
  // null kalau belum ada pembelian settled. Rumusnya satu sumber di investment-holding-math.
  averageCostPerUnit: number | null;
  purchases: InvestmentPurchaseRow[];
  sales: InvestmentSaleRow[];
};

type AccountRow = {
  id: string;
  name: string;
  group_name: string | null;
  is_active: number;
  unit_label: string | null;
  current_market_value: number | null;
  market_value_updated_at: string | null;
  balance: number;
};

// Modal = accounts.balance, rumus on-the-fly yang sama dengan use-accounts.ts.
// Akun tipe investment tanpa baris investment_accounts (seharusnya tidak terjadi) tetap
// muncul dengan nilai pasar 0, bukan hilang dari daftar.
const ACCOUNT_SELECT_SQL = `
  SELECT
    accounts.id,
    accounts.name,
    account_groups.name AS group_name,
    accounts.is_active,
    investment_accounts.unit_label,
    investment_accounts.current_market_value,
    investment_accounts.updated_at AS market_value_updated_at,
    (
      accounts.initial_balance
      + COALESCE((SELECT SUM(CASE
            WHEN t.type = 'income' THEN t.amount
            WHEN t.type = 'expense' THEN -t.amount
            WHEN t.type = 'transfer' THEN -t.amount
            ELSE 0 END)
          FROM transactions t WHERE t.account_id = accounts.id), 0)
      + COALESCE((SELECT SUM(t.amount) FROM transactions t
          WHERE t.type = 'transfer' AND t.transfer_account_id = accounts.id), 0)
    ) AS balance
  FROM accounts
  LEFT JOIN investment_accounts ON investment_accounts.account_id = accounts.id
  LEFT JOIN account_groups ON account_groups.id = accounts.group_id
  WHERE accounts.account_type = 'investment'
`;

function toSummary(row: AccountRow): InvestmentAccountSummary {
  return {
    id: row.id,
    name: row.name,
    groupName: row.group_name,
    isActive: row.is_active === 1,
    unitLabel: row.unit_label ?? "",
    balance: row.balance,
    currentMarketValue: row.current_market_value ?? 0,
    marketValueUpdatedAt: row.market_value_updated_at,
  };
}

export async function getInvestmentAccounts(db: Db): Promise<InvestmentAccountSummary[]> {
  const rows = await db.getAllAsync<AccountRow>(`${ACCOUNT_SELECT_SQL} ORDER BY accounts.name COLLATE NOCASE ASC`);
  return rows.map(toSummary);
}

export async function getInvestmentDetail(db: Db, accountId: string): Promise<InvestmentDetail | null> {
  const accountRow = await db.getFirstAsync<AccountRow>(`${ACCOUNT_SELECT_SQL} AND accounts.id = ?`, [accountId]);
  if (!accountRow) return null;

  // Nominal pembelian = nominal transaksi pembentuknya; fallback unit × harga kalau transaksinya
  // sudah dihapus (transaction_id jadi NULL). Pembelian langsung (hibah/bonus/saldo awal) = transaksi income.
  const purchases = await db.getAllAsync<{
    id: string;
    date: string;
    unit: number | null;
    price_per_unit: number | null;
    status: "pending" | "settled";
    amount: number;
    is_direct: number;
  }>(
    `SELECT p.id, p.date, p.unit, p.price_per_unit, p.status,
            COALESCE(t.amount, p.unit * p.price_per_unit, 0) AS amount,
            CASE WHEN t.type = 'income' THEN 1 ELSE 0 END AS is_direct
     FROM investment_purchases p
     LEFT JOIN transactions t ON t.id = p.transaction_id
     WHERE p.account_id = ?
     ORDER BY p.date DESC, p.created_at DESC`,
    [accountId]
  );

  // price_per_unit = 0 menandai write-off (unit hilang tanpa kas masuk).
  const sales = await db.getAllAsync<{
    id: string;
    date: string;
    unit: number;
    price_per_unit: number;
    average_cost_per_unit: number | null;
    realized_pl: number | null;
    status: "pending" | "settled";
  }>(
    `SELECT id, date, unit, price_per_unit, average_cost_per_unit, realized_pl, status
     FROM investment_sales
     WHERE account_id = ?
     ORDER BY date DESC, created_at DESC`,
    [accountId]
  );

  const averageCostPerUnit = await getAverageCostPerUnit(db, accountId);

  return {
    account: toSummary(accountRow),
    averageCostPerUnit: averageCostPerUnit > 0 ? averageCostPerUnit : null,
    purchases: purchases.map((row) => ({
      id: row.id,
      date: row.date,
      unit: row.unit,
      pricePerUnit: row.price_per_unit,
      amount: row.amount,
      status: row.status,
      isDirect: row.is_direct === 1,
    })),
    sales: sales.map((row) => ({
      id: row.id,
      date: row.date,
      unit: row.unit,
      pricePerUnit: row.price_per_unit,
      averageCost: row.average_cost_per_unit,
      realizedPl: row.realized_pl,
      status: row.status,
      isWriteOff: row.price_per_unit === 0,
    })),
  };
}
