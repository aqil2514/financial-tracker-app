import { describe, expect, it } from "vitest";
import { createSqliteTestDb } from "@/lib/database/testing/sqlite-test-db";
import { getSyncState, resetApplyingPull, setCheckpoint, setWorkerUrl, withApplyingPull } from "./sync-state";

describe("sync-state", () => {
  it("state awal kosong lalu menyimpan URL dan checkpoint", async () => {
    const db = await createSqliteTestDb();
    expect(await getSyncState(db)).toEqual({ workerUrl: null, checkpoint: null, attachmentCheckpoint: null });
    await setWorkerUrl(db, "https://worker.test");
    await setCheckpoint(db, "2026-11-04 05:30:00");
    expect(await getSyncState(db)).toMatchObject({ workerUrl: "https://worker.test", checkpoint: "2026-11-04 05:30:00" });
  });

  it("withApplyingPull menahan antrean dan selalu mengembalikan penanda, juga saat error", async () => {
    const db = await createSqliteTestDb();
    await expect(
      withApplyingPull(db, async () => {
        await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k1', 'Budi')");
        throw new Error("gagal");
      })
    ).rejects.toThrow("gagal");

    expect(await db.getAllAsync("SELECT * FROM cloud_sync_queue")).toEqual([]);
    await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k2', 'Ani')");
    expect(await db.getAllAsync("SELECT row_id FROM cloud_sync_queue")).toEqual([{ row_id: "k2" }]);
  });

  it("resetApplyingPull membersihkan penanda yang tertinggal", async () => {
    const db = await createSqliteTestDb();
    await db.runAsync("UPDATE cloud_sync_state SET applying_pull = 1");
    await resetApplyingPull(db);
    await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k1', 'Budi')");
    expect(await db.getAllAsync("SELECT row_id FROM cloud_sync_queue")).toEqual([{ row_id: "k1" }]);
  });
});
