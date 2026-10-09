import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { pushOnWrite, detachLabelOnWrite } from "@/shared/cloud-sync/push-on-write";

type AccountLabelRow = { id: string; label_id: string };

/** Sama persis apply-transaction-labels.ts, tabel `account_labels`
 * (bukan `transaction_labels`) -- lihat komentar lengkap di sana. */
export async function applyAccountLabels(accountId: string, labelIds: string[]): Promise<void> {
  const db = await getDb();
  const current = await db.select<AccountLabelRow[]>(
    "SELECT id, label_id FROM account_labels WHERE account_id = $1 AND deleted_at IS NULL",
    [accountId]
  );
  const currentByLabelId = new Map(current.map((row) => [row.label_id, row.id]));
  const nextLabelIds = new Set(labelIds);

  for (const labelId of labelIds) {
    if (currentByLabelId.has(labelId)) continue;
    const id = newId();
    await db.execute(
      "INSERT INTO account_labels (id, account_id, label_id) VALUES ($1, $2, $3)",
      [id, accountId, labelId]
    );
    void pushOnWrite("account_labels", id);
  }

  for (const row of current) {
    if (nextLabelIds.has(row.label_id)) continue;
    await db.execute("UPDATE account_labels SET deleted_at = datetime('now') WHERE id = $1", [row.id]);
    void detachLabelOnWrite("accounts", accountId, row.label_id);
  }
}
