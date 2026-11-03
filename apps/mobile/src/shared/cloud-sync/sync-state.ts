import type { SQLiteDatabase } from "expo-sqlite";

export type CloudSyncState = {
  workerUrl: string | null;
  checkpoint: string | null;
  attachmentCheckpoint: string | null;
};

type StateRow = { worker_url: string | null; checkpoint: string | null; attachment_checkpoint: string | null };

export async function getSyncState(db: SQLiteDatabase): Promise<CloudSyncState> {
  const row = await db.getFirstAsync<StateRow>(
    "SELECT worker_url, checkpoint, attachment_checkpoint FROM cloud_sync_state WHERE id = 1"
  );
  return {
    workerUrl: row?.worker_url ?? null,
    checkpoint: row?.checkpoint ?? null,
    attachmentCheckpoint: row?.attachment_checkpoint ?? null,
  };
}

export async function setWorkerUrl(db: SQLiteDatabase, workerUrl: string | null): Promise<void> {
  await db.runAsync("UPDATE cloud_sync_state SET worker_url = ? WHERE id = 1", [workerUrl]);
}

export async function setCheckpoint(db: SQLiteDatabase, checkpoint: string | null): Promise<void> {
  await db.runAsync("UPDATE cloud_sync_state SET checkpoint = ? WHERE id = 1", [checkpoint]);
}

export async function setAttachmentCheckpoint(db: SQLiteDatabase, checkpoint: string | null): Promise<void> {
  await db.runAsync("UPDATE cloud_sync_state SET attachment_checkpoint = ? WHERE id = 1", [checkpoint]);
}

// Penanda gema: selama task berjalan, trigger antrean tidak mencatat perubahan. Selalu dikembalikan ke 0, juga saat error.
export async function withApplyingPull<T>(db: SQLiteDatabase, task: () => Promise<T>): Promise<T> {
  await db.runAsync("UPDATE cloud_sync_state SET applying_pull = 1 WHERE id = 1");
  try {
    return await task();
  } finally {
    await db.runAsync("UPDATE cloud_sync_state SET applying_pull = 0 WHERE id = 1");
  }
}

// Dipanggil saat app start: kalau proses mati di tengah apply, penanda tidak boleh tertinggal 1 (antrean mati selamanya).
export async function resetApplyingPull(db: SQLiteDatabase): Promise<void> {
  await db.runAsync("UPDATE cloud_sync_state SET applying_pull = 0 WHERE id = 1");
}
