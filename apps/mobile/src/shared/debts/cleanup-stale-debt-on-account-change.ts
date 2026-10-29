import { detachDebtForDeletedTransaction } from "./detach-debt-for-deleted-transaction";
import type { Db } from "./types";

// Bersihkan baris debts/debt_payments yatim saat edit transaksi
// memindahkan akun KELUAR dari domain debt (mis. akun sumber diubah
// dari akun bertipe debt ke akun cash) — dipanggil SEBELUM routing
// applyDebtTransactionEdit/applyDirectDebtTransactionEdit (yang akan
// memproses akun BARU, bukan tau apa-apa soal akun lama). Pola sama
// seperti cleanup-stale-domain.ts desktop, versi debt saja (investment/
// third_party belum ada di mobile).
export async function cleanupStaleDebtOnAccountChange(
  db: Db,
  transactionId: string,
  original: { accountId: string; transferAccountId: string | null },
  next: { accountId: string; transferAccountId: string | null }
): Promise<void> {
  const accountChanged =
    next.accountId !== original.accountId || next.transferAccountId !== original.transferAccountId;
  if (!accountChanged) return;

  const oldAccountIds = [original.accountId, original.transferAccountId].filter(
    (id): id is string => id != null
  );
  const newAccountIds = [next.accountId, next.transferAccountId].filter((id): id is string => id != null);

  const [oldTypes, newTypes] = await Promise.all([
    Promise.all(oldAccountIds.map((accountId) => getAccountType(db, accountId))),
    Promise.all(newAccountIds.map((accountId) => getAccountType(db, accountId))),
  ]);

  const oldInvolvesDebt = oldTypes.includes("debt");
  const newInvolvesDebt = newTypes.includes("debt");

  if (oldInvolvesDebt && !newInvolvesDebt) {
    await detachDebtForDeletedTransaction(db, transactionId);
  }
}

async function getAccountType(db: Db, accountId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ account_type: string }>(
    "SELECT account_type FROM accounts WHERE id = ?",
    [accountId]
  );
  return row?.account_type ?? null;
}
