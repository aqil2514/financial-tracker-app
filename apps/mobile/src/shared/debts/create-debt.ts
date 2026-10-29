import { generateId } from "@/lib/database/generate-id";
import type { Db, TouchedDebtRows } from "./types";

export class DebtAccountDirectionMissingError extends Error {
  constructor(accountName: string) {
    super(
      `Akun "${accountName}" belum punya arah (Piutang/Utang) yang ditentukan — lengkapi dulu lewat "Edit Akun" sebelum dipakai di transaksi utang piutang.`
    );
    this.name = "DebtAccountDirectionMissingError";
  }
}

export async function requireDebtAccountDirection(
  db: Db,
  accountId: string
): Promise<"receivable" | "payable"> {
  const row = await db.getFirstAsync<{ name: string; direction: "receivable" | "payable" | null }>(
    `SELECT accounts.name, debt_accounts.direction FROM accounts
     LEFT JOIN debt_accounts ON debt_accounts.account_id = accounts.id
     WHERE accounts.id = ?`,
    [accountId]
  );

  if (!row || !row.direction) {
    throw new DebtAccountDirectionMissingError(row?.name ?? accountId);
  }

  return row.direction;
}

export async function createDebt({
  db,
  type,
  contactId,
  amount,
  accountId,
  transactionId,
  date,
}: {
  db: Db;
  type: "receivable" | "payable";
  contactId: string | null;
  amount: number;
  accountId: string;
  transactionId: string;
  date: string;
}): Promise<TouchedDebtRows> {
  const id = generateId();
  await db.runAsync(
    `INSERT INTO debts (id, type, contact_id, amount, account_id, transaction_id, date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, type, contactId, amount, accountId, transactionId, date]
  );
  return { debtIds: [id], debtPaymentIds: [] };
}
