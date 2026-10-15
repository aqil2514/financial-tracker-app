import type { Db } from "./types";

export type DeletedTransactionInvestmentInfo =
  | { role: "none" }
  | { role: "purchase"; investmentPurchaseId: string };

async function getTransactionInvestmentPurchaseId(
  db: Db,
  transactionId: string
): Promise<string | null> {
  const rows = await db.select<{ id: string }[]>(
    "SELECT id FROM investment_purchases WHERE transaction_id = $1",
    [transactionId]
  );
  return rows[0]?.id ?? null;
}

export async function detachInvestmentPurchaseForDeletedTransaction(
  db: Db,
  transactionId: string
): Promise<DeletedTransactionInvestmentInfo> {
  const existingId = await getTransactionInvestmentPurchaseId(db, transactionId);
  if (existingId == null) return { role: "none" };

  await db.execute("DELETE FROM investment_purchases WHERE id = $1", [existingId]);
  return { role: "purchase", investmentPurchaseId: existingId };
}
