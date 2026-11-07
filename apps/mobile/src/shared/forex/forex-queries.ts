import type { SQLiteDatabase } from "expo-sqlite";

export type ForexAccountSummary = {
  id: string;
  name: string;
  groupName: string | null;
  isActive: boolean;
  country: string;
  currency: string;
  // Modal = accounts.balance (rupiah), tidak pernah ikut naik-turun mengikuti kurs.
  balance: number;
  currentRate: number;
  rateUpdatedAt: string | null;
  remainingUnit: number;
  // unit tersisa × kurs terkini; murni informasional.
  currentValue: number;
  // Average cost atas posisi tersisa = modal / sisa unit (0 kalau tidak ada unit).
  averageCost: number;
};

export type ForexPurchaseRow = {
  id: string;
  transactionId: string | null;
  date: string;
  unit: number;
  rate: number;
  amount: number;
  isDirect: boolean;
};

export type ForexSaleRow = {
  id: string;
  transactionId: string | null;
  date: string;
  unit: number;
  rate: number;
  averageCost: number;
  realizedPl: number;
};

export type ForexDetail = {
  account: ForexAccountSummary;
  purchases: ForexPurchaseRow[];
  sales: ForexSaleRow[];
  totalRealizedPl: number;
};

type AccountRow = {
  id: string;
  name: string;
  group_name: string | null;
  is_active: number;
  country: string | null;
  currency: string | null;
  current_rate: number | null;
  rate_updated_at: string | null;
  purchased_unit: number;
  sold_unit: number;
  balance: number;
};

// Modal = saldo akun, rumus on-the-fly yang sama dengan use-accounts.ts. Akun forex tanpa baris forex_accounts
// (seharusnya tidak terjadi) tetap muncul dengan kurs 0, bukan hilang dari daftar.
const ACCOUNT_SELECT_SQL = `
  SELECT
    accounts.id,
    accounts.name,
    account_groups.name AS group_name,
    accounts.is_active,
    forex_accounts.country,
    forex_accounts.currency,
    forex_accounts.current_rate,
    forex_accounts.updated_at AS rate_updated_at,
    COALESCE((SELECT SUM(unit) FROM forex_purchases WHERE account_id = accounts.id), 0) AS purchased_unit,
    COALESCE((SELECT SUM(unit) FROM forex_sales WHERE account_id = accounts.id), 0) AS sold_unit,
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
  LEFT JOIN forex_accounts ON forex_accounts.account_id = accounts.id
  LEFT JOIN account_groups ON account_groups.id = accounts.group_id
  WHERE accounts.account_type = 'forex'
`;

function toSummary(row: AccountRow): ForexAccountSummary {
  const remainingUnit = row.purchased_unit - row.sold_unit;
  const currentRate = row.current_rate ?? 0;
  return {
    id: row.id,
    name: row.name,
    groupName: row.group_name,
    isActive: row.is_active === 1,
    country: row.country ?? "",
    currency: row.currency ?? "",
    balance: row.balance,
    currentRate,
    rateUpdatedAt: row.rate_updated_at,
    remainingUnit,
    currentValue: remainingUnit > 0 ? remainingUnit * currentRate : 0,
    averageCost: remainingUnit > 0 ? row.balance / remainingUnit : 0,
  };
}

export async function getForexAccounts(db: SQLiteDatabase): Promise<ForexAccountSummary[]> {
  const rows = await db.getAllAsync<AccountRow>(`${ACCOUNT_SELECT_SQL} ORDER BY accounts.name COLLATE NOCASE ASC`);
  return rows.map(toSummary);
}

export async function getForexDetail(db: SQLiteDatabase, accountId: string): Promise<ForexDetail | null> {
  const accountRow = await db.getFirstAsync<AccountRow>(`${ACCOUNT_SELECT_SQL} AND accounts.id = ?`, [accountId]);
  if (!accountRow) return null;

  // Nominal pembelian = nominal transaksi pembentuknya; fallback unit × kurs kalau transaksinya sudah hilang.
  // Pembelian langsung (valas yang sudah dipegang tanpa kas sumber) = transaksi income.
  const purchases = await db.getAllAsync<{
    id: string;
    transaction_id: string | null;
    date: string;
    unit: number;
    rate: number;
    amount: number;
    is_direct: number;
  }>(
    `SELECT p.id, p.transaction_id, p.date, p.unit, p.rate,
            COALESCE(t.amount, p.unit * p.rate) AS amount,
            CASE WHEN t.type = 'income' THEN 1 ELSE 0 END AS is_direct
     FROM forex_purchases p
     LEFT JOIN transactions t ON t.id = p.transaction_id
     WHERE p.account_id = ?
     ORDER BY p.date DESC, p.created_at DESC`,
    [accountId]
  );

  const sales = await db.getAllAsync<{
    id: string;
    transaction_id: string | null;
    date: string;
    unit: number;
    rate: number;
    average_cost_per_unit: number;
    realized_pl: number;
  }>(
    `SELECT id, transaction_id, date, unit, rate, average_cost_per_unit, realized_pl
     FROM forex_sales
     WHERE account_id = ?
     ORDER BY date DESC, created_at DESC`,
    [accountId]
  );

  return {
    account: toSummary(accountRow),
    purchases: purchases.map((row) => ({
      id: row.id,
      transactionId: row.transaction_id,
      date: row.date,
      unit: row.unit,
      rate: row.rate,
      amount: row.amount,
      isDirect: row.is_direct === 1,
    })),
    sales: sales.map((row) => ({
      id: row.id,
      transactionId: row.transaction_id,
      date: row.date,
      unit: row.unit,
      rate: row.rate,
      averageCost: row.average_cost_per_unit,
      realizedPl: row.realized_pl,
    })),
    totalRealizedPl: sales.reduce((sum, row) => sum + row.realized_pl, 0),
  };
}
