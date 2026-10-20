import { getDb } from "@/lib/db";

type Db = Awaited<ReturnType<typeof getDb>>;

export type OrphanTransaction = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  account_id: string | null;
  account_name: string | null;
  account_type: "debt" | "investment";
  note: string;
  date: string;
};

async function findOrphanDebtTransactions(db: Db): Promise<OrphanTransaction[]> {
  return db.select<OrphanTransaction[]>(
    `SELECT t.id, t.type, t.amount, t.account_id, a.name AS account_name, 'debt' AS account_type, t.note, t.date
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     LEFT JOIN accounts ta ON ta.id = t.transfer_account_id
     WHERE a.account_type = 'debt'
       AND a.deleted_at IS NULL
       AND t.deleted_at IS NULL
       AND NOT (t.type = 'transfer' AND ta.account_type = 'debt')
       AND NOT EXISTS (SELECT 1 FROM debts d WHERE d.transaction_id = t.id AND d.deleted_at IS NULL)
       AND NOT EXISTS (SELECT 1 FROM debt_payments dp WHERE dp.transaction_id = t.id AND dp.deleted_at IS NULL)
       AND NOT EXISTS (SELECT 1 FROM debt_amount_adjustments daa WHERE daa.transaction_id = t.id)
     UNION ALL
     SELECT t.id, t.type, t.amount, t.transfer_account_id AS account_id, ta.name AS account_name, 'debt' AS account_type, t.note, t.date
     FROM transactions t
     JOIN accounts ta ON ta.id = t.transfer_account_id
     JOIN accounts a ON a.id = t.account_id
     WHERE t.type = 'transfer'
       AND ta.account_type = 'debt'
       AND ta.deleted_at IS NULL
       AND t.deleted_at IS NULL
       AND a.account_type != 'debt'
       AND NOT EXISTS (SELECT 1 FROM debts d WHERE d.transaction_id = t.id AND d.deleted_at IS NULL)
       AND NOT EXISTS (SELECT 1 FROM debt_payments dp WHERE dp.transaction_id = t.id AND dp.deleted_at IS NULL)
       AND NOT EXISTS (SELECT 1 FROM debt_amount_adjustments daa WHERE daa.transaction_id = t.id)
     ORDER BY date DESC`
  );
}

async function findOrphanInvestmentTransactions(db: Db): Promise<OrphanTransaction[]> {
  return db.select<OrphanTransaction[]>(
    `SELECT t.id, t.type, t.amount, t.account_id, a.name AS account_name, 'investment' AS account_type, t.note, t.date
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     LEFT JOIN accounts ta ON ta.id = t.transfer_account_id
     WHERE a.account_type = 'investment'
       AND a.deleted_at IS NULL
       AND t.deleted_at IS NULL
       AND NOT (t.type = 'transfer' AND ta.account_type = 'investment')
       AND NOT EXISTS (SELECT 1 FROM investment_purchases ip WHERE ip.transaction_id = t.id AND ip.deleted_at IS NULL)
       AND NOT EXISTS (SELECT 1 FROM investment_sales ivs WHERE ivs.transaction_id = t.id AND ivs.deleted_at IS NULL)
     UNION ALL
     SELECT t.id, t.type, t.amount, t.transfer_account_id AS account_id, ta.name AS account_name, 'investment' AS account_type, t.note, t.date
     FROM transactions t
     JOIN accounts ta ON ta.id = t.transfer_account_id
     JOIN accounts a ON a.id = t.account_id
     WHERE t.type = 'transfer'
       AND ta.account_type = 'investment'
       AND ta.deleted_at IS NULL
       AND t.deleted_at IS NULL
       AND a.account_type != 'investment'
       AND NOT EXISTS (SELECT 1 FROM investment_purchases ip WHERE ip.transaction_id = t.id AND ip.deleted_at IS NULL)
       AND NOT EXISTS (SELECT 1 FROM investment_sales ivs WHERE ivs.transaction_id = t.id AND ivs.deleted_at IS NULL)
     ORDER BY date DESC`
  );
}

export async function checkBalanceConsistency(db: Db): Promise<OrphanTransaction[]> {
  const [orphanDebts, orphanInvestments] = await Promise.all([
    findOrphanDebtTransactions(db),
    findOrphanInvestmentTransactions(db),
  ]);
  return [...orphanDebts, ...orphanInvestments].sort((a, b) => (a.date < b.date ? 1 : -1));
}
