import { resolveContactId } from "@/shared/contacts/resolve-contact";
import type { ArApSyncPlanRow, Db } from "../types";

// row.amount sudah dijamin positif oleh buildArApPlanRows (amount<=0 di-skip).
// row.willUpdate menentukan UPDATE (mode overwrite, debts.id tetap sama)
// vs INSERT baris baru — keduanya lewat fungsi ini supaya resolusi
// kontak tidak terduplikasi di 2 tempat.
export async function insertArApTransaction(db: Db, row: ArApSyncPlanRow): Promise<void> {
  const contactId = row.contactFollowSource ? await resolveContactId(row.partyName) : row.contactId;

  if (row.willUpdate) {
    await db.execute(
      `UPDATE debts SET type = $1, contact_id = $2, amount = $3, account_id = $4, date = $5
       WHERE id = $6`,
      [row.direction, contactId, row.amount, row.debtLocalAccountId, row.date, row.existingDebtId]
    );
    return;
  }

  await db.execute(
    `INSERT INTO debts (type, contact_id, amount, account_id, transaction_id, date, source, source_ref)
     VALUES ($1, $2, $3, $4, NULL, $5, 'retailku_sync', $6)`,
    [row.direction, contactId, row.amount, row.debtLocalAccountId, row.date, row.sourceRef]
  );
}
