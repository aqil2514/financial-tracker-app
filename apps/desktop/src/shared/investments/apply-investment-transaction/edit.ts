import { getRemainingUnit } from "../investment-holding-math";
import { applyInvestmentTransaction, type ApplyInvestmentTransactionInput } from "./create";
import type { Db, TouchedInvestmentRows } from "./types";

type ExistingPurchaseRow = {
  id: string;
  account_id: string;
  unit: number | null;
  price_per_unit: number | null;
  status: "pending" | "settled";
};

async function getTransactionInvestmentPurchaseRow(
  db: Db,
  transactionId: string
): Promise<ExistingPurchaseRow | null> {
  const rows = await db.select<ExistingPurchaseRow[]>(
    "SELECT id, account_id, unit, price_per_unit, status FROM investment_purchases WHERE transaction_id = $1",
    [transactionId]
  );
  return rows[0] ?? null;
}

/** Lihat README.md bagian "InvestmentPurchaseEditBlockedError". */
export class InvestmentPurchaseEditBlockedError extends Error {
  constructor(remainingUnitAfterEdit: number) {
    super(
      `Mengubah pembelian ini akan membuat sisa unit akun jadi tidak valid (${remainingUnitAfterEdit}) — ` +
        `sebagian unit sudah terjual lewat transaksi lain. Kurangi jumlah pengurangan unit, atau batalkan perubahan ini.`
    );
    this.name = "InvestmentPurchaseEditBlockedError";
  }
}

export async function applyInvestmentTransactionEdit(
  input: ApplyInvestmentTransactionInput
): Promise<TouchedInvestmentRows> {
  const { db, transactionId, type, unit, pricePerUnit, date, status: newStatus } = input;
  const existing = await getTransactionInvestmentPurchaseRow(db, transactionId);

  if (existing == null) {
    return applyInvestmentTransaction(input);
  }

  if (existing.status === "settled") {
    const unitAfterEdit = type === "transfer" ? unit : (unit ?? existing.unit);
    const statusAfterEdit = type === "transfer" ? (newStatus ?? "pending") : "settled";
    const unitContributionAfterEdit = statusAfterEdit === "settled" ? (unitAfterEdit ?? 0) : 0;
    const remainingUnitExcludingThis = (await getRemainingUnit(db, existing.account_id)) - (existing.unit ?? 0);
    const remainingUnitAfterEdit = remainingUnitExcludingThis + unitContributionAfterEdit;
    if (remainingUnitAfterEdit < 0) {
      throw new InvestmentPurchaseEditBlockedError(remainingUnitAfterEdit);
    }
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
