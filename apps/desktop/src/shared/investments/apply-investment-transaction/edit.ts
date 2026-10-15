import { applyInvestmentTransaction, type ApplyInvestmentTransactionInput } from "./create";
import type { Db, TouchedInvestmentRows } from "./types";

async function getTransactionInvestmentPurchaseRow(
  db: Db,
  transactionId: string
): Promise<{ id: string; unit: number | null; price_per_unit: number | null } | null> {
  const rows = await db.select<{ id: string; unit: number | null; price_per_unit: number | null }[]>(
    "SELECT id, unit, price_per_unit FROM investment_purchases WHERE transaction_id = $1",
    [transactionId]
  );
  return rows[0] ?? null;
}

export async function applyInvestmentTransactionEdit(
  input: ApplyInvestmentTransactionInput
): Promise<TouchedInvestmentRows> {
  const { db, transactionId, type, unit, pricePerUnit, date } = input;
  const existing = await getTransactionInvestmentPurchaseRow(db, transactionId);

  if (existing == null) {
    return applyInvestmentTransaction(input);
  }

  if (type !== "transfer") {
    await db.execute(
      "UPDATE investment_purchases SET unit = $1, price_per_unit = $2, date = $3 WHERE id = $4",
      [unit ?? existing.unit, pricePerUnit ?? existing.price_per_unit, date, existing.id]
    );
    return { investmentPurchaseIds: [existing.id], deletedInvestmentPurchaseIds: [] };
  }

  await db.execute("DELETE FROM investment_purchases WHERE id = $1", [existing.id]);
  const result = await applyInvestmentTransaction(input);
  return {
    investmentPurchaseIds: result.investmentPurchaseIds,
    deletedInvestmentPurchaseIds: [existing.id, ...result.deletedInvestmentPurchaseIds],
  };
}
