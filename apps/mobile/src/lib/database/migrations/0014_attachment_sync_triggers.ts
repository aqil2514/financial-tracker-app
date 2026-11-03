import type { SQLiteDatabase } from "expo-sqlite";

// Trigger antrean untuk transaction_attachments (Fase 5). Tabel ini tanpa updated_at dan barisnya tidak pernah
// diedit, jadi cukup INSERT dan DELETE. Daftar CHECK cloud_sync_queue sudah memuat tabel ini sejak 0012.
const NOT_APPLYING_PULL = "(SELECT applying_pull FROM cloud_sync_state WHERE id = 1) = 0";

export async function up(db: SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      CREATE TRIGGER trg_transaction_attachments_queue_ins
      AFTER INSERT ON transaction_attachments
      FOR EACH ROW WHEN ${NOT_APPLYING_PULL}
      BEGIN
        INSERT INTO cloud_sync_queue (table_name, row_id, op)
        VALUES ('transaction_attachments', NEW.id, 'upsert')
        ON CONFLICT (table_name, row_id) DO UPDATE SET op = 'upsert', attempts = 0, last_error = NULL;
      END;

      CREATE TRIGGER trg_transaction_attachments_queue_del
      AFTER DELETE ON transaction_attachments
      FOR EACH ROW WHEN ${NOT_APPLYING_PULL}
      BEGIN
        INSERT INTO cloud_sync_queue (table_name, row_id, op)
        VALUES ('transaction_attachments', OLD.id, 'delete')
        ON CONFLICT (table_name, row_id) DO UPDATE SET op = 'delete', attempts = 0, last_error = NULL;
      END;
    `);
  });
}
