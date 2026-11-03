import { beforeEach, describe, expect, it } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { createSqliteTestDb } from "@/lib/database/testing/sqlite-test-db";
import type { AttachmentTransport } from "./attachment-transport-types";
import { enqueueAllRows } from "./enqueue-all";
import { flushPushQueue } from "./flush-push-queue";
import { runAttachmentPull } from "./pull-attachments";
import { getSyncState } from "./sync-state";
import type { FetchLike } from "./worker-client";

const creds = { workerUrl: "https://worker.test", token: "tok" };

type Upload = { id: string; transactionId: string; filePath: string; contentType: string | null };

function fakeTransport(options: { existing?: Set<string>; rejectUpload?: string; failDownload?: boolean | string } = {}) {
  const uploads: Upload[] = [];
  const downloads: Array<{ id: string; contentType: string | null }> = [];
  const deleted: string[] = [];
  const transport: AttachmentTransport = {
    fileExists: (path) => (options.existing ? options.existing.has(path) : true),
    upload: async (_creds, args) => {
      uploads.push(args);
      return options.rejectUpload ? { status: "rejected", reason: options.rejectUpload } : { status: "ok" };
    },
    download: async (_creds, args) => {
      if (options.failDownload) throw new Error(typeof options.failDownload === "string" ? options.failDownload : "UnableToDownload: HTTP 500");
      downloads.push(args);
      return `file:///docs/transaction-attachments/${args.id}.bin`;
    },
    deleteFile: (path) => {
      deleted.push(path);
    },
  };
  return { transport, uploads, downloads, deleted };
}

function fetchWithList(attachments: unknown[], checkpoint = "2026-11-04 12:00:00") {
  const calls: string[] = [];
  const impl = (async (url: string, init: RequestInit = {}) => {
    calls.push(`${init.method ?? "GET"} ${url.replace("https://worker.test", "")}`);
    const body = url.includes("/attachments") && (init.method ?? "GET") === "GET" ? { checkpoint, attachments } : { status: "ok" };
    return { ok: true, status: 200, json: async () => body };
  }) as unknown as FetchLike;
  return { calls, impl };
}

const queue = (db: SQLiteDatabase) =>
  db.getAllAsync<{ table_name: string; row_id: string; op: string }>("SELECT table_name, row_id, op FROM cloud_sync_queue ORDER BY id");

async function seedTransaction(db: SQLiteDatabase, id = "t1") {
  await db.runAsync("INSERT OR IGNORE INTO accounts (id, name) VALUES ('a1', 'Kas')");
  await db.runAsync(
    "INSERT INTO transactions (id, note, type, amount, date, account_id) VALUES (?, 'n', 'expense', 1, '2026-11-04T10:00', 'a1')",
    [id]
  );
  await db.runAsync("DELETE FROM cloud_sync_queue");
}

describe("attachment sync", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createSqliteTestDb();
  });

  describe("antrean", () => {
    it("INSERT dan DELETE attachment masuk antrean; saat apply pull tidak", async () => {
      await seedTransaction(db);
      await db.runAsync("INSERT INTO transaction_attachments (id, transaction_id, file_path) VALUES ('att1', 't1', 'file:///a.jpg')");
      expect(await queue(db)).toEqual([{ table_name: "transaction_attachments", row_id: "att1", op: "upsert" }]);

      await db.runAsync("DELETE FROM transaction_attachments WHERE id = 'att1'");
      expect(await queue(db)).toEqual([{ table_name: "transaction_attachments", row_id: "att1", op: "delete" }]);

      await db.runAsync("DELETE FROM cloud_sync_queue");
      await db.runAsync("UPDATE cloud_sync_state SET applying_pull = 1");
      await db.runAsync("INSERT INTO transaction_attachments (id, transaction_id, file_path) VALUES ('att2', 't1', 'file:///b.jpg')");
      expect(await queue(db)).toEqual([]);
    });

    it("enqueueAllRows ikut memasukkan attachment yang sudah ada", async () => {
      await seedTransaction(db);
      await db.runAsync("UPDATE cloud_sync_state SET applying_pull = 1");
      await db.runAsync("INSERT INTO transaction_attachments (id, transaction_id, file_path) VALUES ('att1', 't1', 'file:///a.jpg')");
      await db.runAsync("UPDATE cloud_sync_state SET applying_pull = 0");
      await db.runAsync("DELETE FROM cloud_sync_queue");
      await enqueueAllRows(db);
      expect(await queue(db)).toContainEqual({ table_name: "transaction_attachments", row_id: "att1", op: "upsert" });
    });
  });

  describe("push", () => {
    it("mengunggah file dengan content type dari ekstensi, setelah transaksinya, lalu mengosongkan antrean", async () => {
      await db.runAsync("INSERT INTO accounts (id, name) VALUES ('a1', 'Kas')");
      await db.runAsync("INSERT INTO transactions (id, note, type, amount, date, account_id) VALUES ('t1', 'n', 'expense', 1, '2026-11-04T10:00', 'a1')");
      await db.runAsync("INSERT INTO transaction_attachments (id, transaction_id, file_path) VALUES ('att1', 't1', 'file:///docs/foto.JPG')");

      const { transport, uploads } = fakeTransport();
      const { calls, impl } = fetchWithList([]);
      const result = await flushPushQueue(db, creds, impl, transport);

      expect(result).toMatchObject({ failed: 0, aborted: false });
      expect(uploads).toEqual([{ id: "att1", transactionId: "t1", filePath: "file:///docs/foto.JPG", contentType: "image/jpeg" }]);
      expect(calls.indexOf("POST /transactions")).toBeLessThan(calls.length);
      expect(await queue(db)).toEqual([]);
    });

    it("file lokal hilang: tidak ada upload, entry dibuang", async () => {
      await seedTransaction(db);
      await db.runAsync("INSERT INTO transaction_attachments (id, transaction_id, file_path) VALUES ('att1', 't1', 'file:///hilang.jpg')");
      const { transport, uploads } = fakeTransport({ existing: new Set() });
      await flushPushQueue(db, creds, fetchWithList([]).impl, transport);
      expect(uploads).toEqual([]);
      expect(await queue(db)).toEqual([]);
    });

    it("422 dicatat ke rejected log dan entry tetap", async () => {
      await seedTransaction(db);
      await db.runAsync("INSERT INTO transaction_attachments (id, transaction_id, file_path) VALUES ('att1', 't1', 'file:///a.png')");
      const { transport } = fakeTransport({ rejectUpload: "transaksi tidak ditemukan" });
      const result = await flushPushQueue(db, creds, fetchWithList([]).impl, transport);
      expect(result).toMatchObject({ failed: 1 });
      expect(await queue(db)).toHaveLength(1);
      expect(await db.getAllAsync("SELECT table_name, row_id, direction, reason FROM cloud_sync_rejected_log")).toEqual([
        { table_name: "transaction_attachments", row_id: "att1", direction: "push", reason: "transaksi tidak ditemukan" },
      ]);
    });

    it("hapus attachment mengirim DELETE /attachments/:id", async () => {
      await seedTransaction(db);
      await db.runAsync("INSERT INTO cloud_sync_queue (table_name, row_id, op) VALUES ('transaction_attachments', 'att9', 'delete')");
      const { transport } = fakeTransport();
      const { calls, impl } = fetchWithList([]);
      await flushPushQueue(db, creds, impl, transport);
      expect(calls).toEqual(["DELETE /attachments/att9"]);
      expect(await queue(db)).toEqual([]);
    });
  });

  describe("pull", () => {
    const item = (id: string, transactionId: string, extra: Record<string, unknown> = {}) => ({
      id,
      transactionId,
      contentType: "image/jpeg",
      sizeBytes: 10,
      updatedAt: "2026-11-04 11:00:00",
      deletedAt: null,
      ...extra,
    });

    it("mengunduh attachment baru, mengisi baris dan has_attachment, tanpa gema, dan memajukan checkpoint", async () => {
      await seedTransaction(db);
      const { transport, downloads } = fakeTransport();
      const { calls, impl } = fetchWithList([item("att1", "t1")]);

      const result = await runAttachmentPull(db, creds, impl, transport);

      expect(calls).toEqual(["GET /attachments"]);
      expect(result).toEqual({ applied: 1, rejected: 0, skipped: 0, checkpointAdvanced: true });
      expect(downloads).toEqual([{ id: "att1", contentType: "image/jpeg" }]);
      expect(await db.getFirstAsync("SELECT id, transaction_id, file_path FROM transaction_attachments")).toEqual({
        id: "att1",
        transaction_id: "t1",
        file_path: "file:///docs/transaction-attachments/att1.bin",
      });
      expect(await db.getFirstAsync("SELECT has_attachment FROM transactions WHERE id = 't1'")).toEqual({ has_attachment: 1 });
      expect(await queue(db)).toEqual([]);
      expect((await getSyncState(db)).attachmentCheckpoint).toBe("2026-11-04 12:00:00");
    });

    it("pull berikutnya memakai checkpoint, dan attachment yang sudah ada tidak diunduh ulang", async () => {
      await seedTransaction(db);
      const { transport, downloads } = fakeTransport();
      await runAttachmentPull(db, creds, fetchWithList([item("att1", "t1")]).impl, transport);

      const second = fetchWithList([item("att1", "t1")]);
      await runAttachmentPull(db, creds, second.impl, transport);
      expect(second.calls).toEqual(["GET /attachments?since=2026-11-04%2012%3A00%3A00"]);
      expect(downloads).toHaveLength(1);
    });

    it("deletedAt menghapus baris dan file lokal, dan menghitung ulang has_attachment", async () => {
      await seedTransaction(db);
      const { transport, deleted } = fakeTransport();
      await runAttachmentPull(db, creds, fetchWithList([item("att1", "t1")]).impl, transport);

      const result = await runAttachmentPull(
        db,
        creds,
        fetchWithList([item("att1", "t1", { deletedAt: "2026-11-04 12:30:00" })], "2026-11-04 13:00:00").impl,
        transport
      );
      expect(result.applied).toBe(1);
      expect(deleted).toEqual(["file:///docs/transaction-attachments/att1.bin"]);
      expect(await db.getAllAsync("SELECT id FROM transaction_attachments")).toEqual([]);
      expect(await db.getFirstAsync("SELECT has_attachment FROM transactions WHERE id = 't1'")).toEqual({ has_attachment: 0 });
      expect(await queue(db)).toEqual([]);
    });

    it("tombstone untuk attachment yang tidak ada lokal tidak dihitung", async () => {
      const { transport } = fakeTransport();
      const result = await runAttachmentPull(
        db,
        creds,
        fetchWithList([item("hantu", "t-x", { deletedAt: "2026-11-04 12:30:00" })]).impl,
        transport
      );
      expect(result).toMatchObject({ applied: 0, rejected: 0 });
    });

    it("induk tidak ada: pull penuh dilewati permanen, inkremental menahan checkpoint", async () => {
      const { transport, downloads } = fakeTransport();

      const full = await runAttachmentPull(db, creds, fetchWithList([item("att1", "t-hilang")]).impl, transport);
      expect(full).toEqual({ applied: 0, rejected: 0, skipped: 1, checkpointAdvanced: true });
      expect(downloads).toEqual([]);
      expect(await db.getFirstAsync<{ reason: string }>("SELECT reason FROM cloud_sync_rejected_log")).toMatchObject({
        reason: expect.stringMatching(/^dilewati: /),
      });

      const incremental = await runAttachmentPull(db, creds, fetchWithList([item("att2", "t-hilang")]).impl, transport);
      expect(incremental).toEqual({ applied: 0, rejected: 1, skipped: 0, checkpointAdvanced: false });
      expect((await getSyncState(db)).attachmentCheckpoint).toBe("2026-11-04 12:00:00");
    });

    it("unduhan 404 (file hilang di cloud) dilewati permanen dan tidak menahan checkpoint", async () => {
      await seedTransaction(db);
      const { transport } = fakeTransport({ failDownload: "Unable to download a file: response has status: 404" });
      const result = await runAttachmentPull(db, creds, fetchWithList([item("att1", "t1")]).impl, transport);
      expect(result).toEqual({ applied: 0, rejected: 0, skipped: 1, checkpointAdvanced: true });
      expect(await db.getAllAsync("SELECT id FROM transaction_attachments")).toEqual([]);
      expect(await db.getFirstAsync<{ reason: string }>("SELECT reason FROM cloud_sync_rejected_log")).toMatchObject({
        reason: expect.stringMatching(/^dilewati: file tidak ada di cloud/),
      });
    });

    it("unduhan gagal: dicatat, baris tidak dibuat, checkpoint tidak maju", async () => {
      await seedTransaction(db);
      const { transport } = fakeTransport({ failDownload: true });
      const result = await runAttachmentPull(db, creds, fetchWithList([item("att1", "t1")]).impl, transport);
      expect(result).toEqual({ applied: 0, rejected: 1, skipped: 0, checkpointAdvanced: false });
      expect(await db.getAllAsync("SELECT id FROM transaction_attachments")).toEqual([]);
      expect(await db.getFirstAsync<{ reason: string }>("SELECT reason FROM cloud_sync_rejected_log")).toMatchObject({
        reason: expect.stringContaining("UnableToDownload"),
      });
      expect((await getSyncState(db)).attachmentCheckpoint).toBeNull();
    });
  });
});
