import type { SQLiteDatabase } from "expo-sqlite";
import { assertPurchaseEditKeepsUnitsValid, type ExistingPurchase } from "./investment-purchase-edit-guard";

export type UpdateInvestmentPurchaseInput = {
  db: SQLiteDatabase;
  purchaseId: string;
  unit: number | null;
  pricePerUnit: number | null;
  status: "pending" | "settled";
};

// Koreksi unit/harga/status satu baris pembelian secara LANGSUNG (kasus utama: isi unit dan harga final begitu
// settlement dikonfirmasi, lalu tandai settled). Tidak menyentuh transactions maupun accounts.balance.
export async function updateInvestmentPurchase({ db, purchaseId, unit, pricePerUnit, status }: UpdateInvestmentPurchaseInput) {
  const existing = await db.getFirstAsync<ExistingPurchase>(
    "SELECT account_id, unit, status FROM investment_purchases WHERE id = ?",
    [purchaseId]
  );
  if (!existing) throw new Error("Pembelian tidak ditemukan.");

  await assertPurchaseEditKeepsUnitsValid(db, existing, status === "settled" ? (unit ?? 0) : 0);

  await db.runAsync("UPDATE investment_purchases SET unit = ?, price_per_unit = ?, status = ? WHERE id = ?", [
    unit,
    pricePerUnit,
    status,
    purchaseId,
  ]);
}
