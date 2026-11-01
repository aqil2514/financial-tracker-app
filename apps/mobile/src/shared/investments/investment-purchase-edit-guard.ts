import type { SQLiteDatabase } from "expo-sqlite";
import { getRemainingUnit } from "./investment-holding-math";

// Penjualan yang sudah terjadi menyimpan snapshot average cost/realized P/L, jadi mengurangi atau menghapus
// unit pembelian settled yang sudah "terpakai" membuat sisa unit negatif secara retroaktif. Beda dari
// unit × harga vs nominal transfer yang sengaja tidak divalidasi (itu konsistensi satu baris saat input).
export class InvestmentPurchaseEditBlockedError extends Error {
  constructor(remainingUnitAfterEdit: number) {
    super(
      `Mengubah pembelian ini akan membuat sisa unit akun jadi tidak valid (${remainingUnitAfterEdit}) — ` +
        `sebagian unit sudah terjual lewat transaksi lain. Kurangi jumlah pengurangan unit, atau batalkan perubahan ini.`
    );
    this.name = "InvestmentPurchaseEditBlockedError";
  }
}

export type ExistingPurchase = {
  account_id: string;
  unit: number | null;
  status: "pending" | "settled";
};

// Hanya baris settled yang ikut getRemainingUnit, jadi baris pending tidak pernah berisiko.
// `unitContributionAfterEdit` = unit yang masih dihitung dari baris ini SETELAH edit (0 kalau dihapus/pending).
export async function assertPurchaseEditKeepsUnitsValid(
  db: SQLiteDatabase,
  existing: ExistingPurchase,
  unitContributionAfterEdit: number
) {
  if (existing.status !== "settled") return;

  const remainingExcludingThis = (await getRemainingUnit(db, existing.account_id)) - (existing.unit ?? 0);
  const remainingAfterEdit = remainingExcludingThis + unitContributionAfterEdit;
  if (remainingAfterEdit < 0) throw new InvestmentPurchaseEditBlockedError(remainingAfterEdit);
}
