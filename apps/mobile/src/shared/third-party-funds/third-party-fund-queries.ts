import type { SQLiteDatabase } from "expo-sqlite";

export type ThirdPartyAccountSummary = {
  id: string;
  name: string;
  groupName: string | null;
  isActive: boolean;
  balance: number;
};

export type ThirdPartySummaryRow = {
  accountId: string;
  accountName: string;
  contactId: string;
  contactName: string;
  remaining: number;
};

export type ThirdPartyFundHistoryRow = {
  id: string;
  transactionId: string | null;
  date: string;
  direction: "in" | "out";
  amount: number;
  note: string | null;
  accountId: string;
  accountName: string;
  contactId: string;
  contactName: string;
  // Baris transfer (pindah tempat/kepemilikan) tidak bisa diedit, hanya dihapus bersama pasangannya.
  isTransfer: boolean;
};

type AccountRow = {
  id: string;
  name: string;
  group_name: string | null;
  is_active: number;
  balance: number;
};

// Saldo = rumus on-the-fly yang sama dengan use-accounts.ts / investment-queries.ts.
export async function getThirdPartyAccounts(db: SQLiteDatabase): Promise<ThirdPartyAccountSummary[]> {
  const rows = await db.getAllAsync<AccountRow>(
    `SELECT
       accounts.id,
       accounts.name,
       account_groups.name AS group_name,
       accounts.is_active,
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
     LEFT JOIN account_groups ON account_groups.id = accounts.group_id
     WHERE accounts.account_type = 'third_party'
     ORDER BY accounts.name ASC`
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    groupName: row.group_name,
    isActive: row.is_active === 1,
    balance: row.balance,
  }));
}

// Siapa menitip berapa, di mana: pasangan (akun, kontak) yang sudah lunas (sisa 0) tidak ditampilkan.
export async function getThirdPartySummary(db: SQLiteDatabase): Promise<ThirdPartySummaryRow[]> {
  const rows = await db.getAllAsync<{
    account_id: string;
    account_name: string;
    contact_id: string;
    contact_name: string;
    remaining: number;
  }>(
    `SELECT f.account_id, a.name AS account_name, f.contact_id, c.name AS contact_name,
            SUM(CASE WHEN f.direction = 'in' THEN f.amount ELSE -f.amount END) AS remaining
     FROM third_party_funds f
     JOIN accounts a ON a.id = f.account_id
     JOIN contacts c ON c.id = f.contact_id
     GROUP BY f.account_id, f.contact_id
     HAVING remaining != 0
     ORDER BY c.name ASC, a.name ASC`
  );
  return rows.map((row) => ({
    accountId: row.account_id,
    accountName: row.account_name,
    contactId: row.contact_id,
    contactName: row.contact_name,
    remaining: row.remaining,
  }));
}

type FundRow = {
  id: string;
  transaction_id: string | null;
  date: string;
  direction: "in" | "out";
  amount: number;
  note: string | null;
  account_id: string;
  account_name: string;
  contact_id: string;
  contact_name: string;
  transaction_type: string | null;
};

const FUND_SELECT_SQL = `
  SELECT f.id, f.transaction_id, f.date, f.direction, f.amount, f.note,
         f.account_id, a.name AS account_name, f.contact_id, c.name AS contact_name,
         t.type AS transaction_type
  FROM third_party_funds f
  JOIN accounts a ON a.id = f.account_id
  JOIN contacts c ON c.id = f.contact_id
  LEFT JOIN transactions t ON t.id = f.transaction_id
`;

function toHistoryRow(row: FundRow): ThirdPartyFundHistoryRow {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    date: row.date,
    direction: row.direction,
    amount: row.amount,
    note: row.note,
    accountId: row.account_id,
    accountName: row.account_name,
    contactId: row.contact_id,
    contactName: row.contact_name,
    isTransfer: row.transaction_type === "transfer",
  };
}

// Riwayat lintas SEMUA akun third_party, terbaru dulu.
export async function getThirdPartyFundHistory(db: SQLiteDatabase): Promise<ThirdPartyFundHistoryRow[]> {
  const rows = await db.getAllAsync<FundRow>(
    `${FUND_SELECT_SQL} ORDER BY f.date DESC, f.created_at DESC, f.rowid DESC`
  );
  return rows.map(toHistoryRow);
}

export async function getThirdPartyFund(db: SQLiteDatabase, fundId: string): Promise<ThirdPartyFundHistoryRow | null> {
  const row = await db.getFirstAsync<FundRow>(`${FUND_SELECT_SQL} WHERE f.id = ?`, [fundId]);
  return row ? toHistoryRow(row) : null;
}
