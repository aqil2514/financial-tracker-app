import type { SQLiteDatabase } from "expo-sqlite";
import { loadDefaultAttachmentTransport, type AttachmentTransport } from "./attachment-transport-types";
import { inferContentType } from "./content-type";
import {
  buildPushRequest,
  DELETE_PATH,
  isLabelJunction,
  labelJunctionDeletePath,
  type JsonPushTable,
} from "./push-request";
import { clearRejected, logRejected } from "./rejected-log";
import { PUSH_TABLE_ORDER, type CloudSyncCredentials, type PushTable } from "./types";
import { pushDelete, pushUpsert, WorkerRequestError, type FetchLike } from "./worker-client";

type QueueEntry = { id: number; table_name: string; row_id: string; op: "upsert" | "delete"; payload: string | null };

// Entry yang sudah gagal sebanyak ini tidak dicoba lagi oleh sync otomatis (mis. payload yang selalu ditolak
// validator Worker). Sync manual boleh mencobanya sekali lagi.
export const MAX_AUTO_ATTEMPTS = 5;

export type FlushOptions = { includeExhausted?: boolean };

export type FlushResult = { sent: number; failed: number; aborted: boolean };

function isPushTable(value: string): value is PushTable {
  return (PUSH_TABLE_ORDER as readonly string[]).includes(value);
}

// Upsert: induk dulu (urutan FK). Delete: anak dulu (urutan terbalik), dan setelah semua upsert.
function sortEntries(entries: QueueEntry[]): QueueEntry[] {
  const rank = (entry: QueueEntry) => PUSH_TABLE_ORDER.indexOf(entry.table_name as PushTable);
  const upserts = entries.filter((entry) => entry.op === "upsert").sort((a, b) => rank(a) - rank(b) || a.id - b.id);
  const deletes = entries.filter((entry) => entry.op === "delete").sort((a, b) => rank(b) - rank(a) || a.id - b.id);
  return [...upserts, ...deletes];
}

async function markFailed(db: SQLiteDatabase, entry: QueueEntry, message: string) {
  await db.runAsync("UPDATE cloud_sync_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?", [
    message,
    entry.id,
  ]);
}

// Entry dihapus hanya kalau tidak berubah selama request berjalan; kalau baris diedit lagi di tengah
// jalan, entry (sudah di-reset trigger) harus tetap ada supaya versi terbaru terkirim di putaran berikut.
async function removeIfUnchanged(db: SQLiteDatabase, entry: QueueEntry, sentBody: Record<string, unknown> | null) {
  const current = await db.getFirstAsync<{ op: string }>("SELECT op FROM cloud_sync_queue WHERE id = ?", [entry.id]);
  if (!current || current.op !== entry.op) return;

  if (entry.op === "upsert" && sentBody) {
    const latest = await buildPushRequest(db, entry.table_name as JsonPushTable, entry.row_id);
    if (JSON.stringify(latest?.body) !== JSON.stringify(sentBody)) return;
  }
  await db.runAsync("DELETE FROM cloud_sync_queue WHERE id = ?", [entry.id]);
}

// Attachment: file biner dikirim multipart lewat transport. Tidak ada kolom updated_at dan barisnya tidak
// pernah diedit, jadi entry cukup dihapus setelah sukses (tanpa pembanding versi).
async function pushAttachment(
  db: SQLiteDatabase,
  creds: CloudSyncCredentials,
  entry: QueueEntry,
  transport: AttachmentTransport
): Promise<"sent" | "failed"> {
  const row = await db.getFirstAsync<{ transaction_id: string; file_path: string }>(
    "SELECT transaction_id, file_path FROM transaction_attachments WHERE id = ?",
    [entry.row_id]
  );
  // Baris atau file lokal sudah tidak ada: tidak ada yang bisa dikirim.
  if (!row || !transport.fileExists(row.file_path)) {
    await removeIfUnchanged(db, entry, null);
    return "sent";
  }

  const result = await transport.upload(creds, {
    id: entry.row_id,
    transactionId: row.transaction_id,
    filePath: row.file_path,
    contentType: inferContentType(row.file_path),
  });
  if (result.status === "rejected") {
    await markFailed(db, entry, `rejected: ${result.reason}`);
    await logRejected(db, "push", entry.table_name, entry.row_id, result.reason);
    return "failed";
  }
  await clearRejected(db, "push", entry.table_name, entry.row_id);
  await removeIfUnchanged(db, entry, null);
  return "sent";
}

async function pushEntry(
  db: SQLiteDatabase,
  creds: CloudSyncCredentials,
  entry: QueueEntry,
  table: PushTable,
  fetchImpl: FetchLike | undefined,
  getTransport: () => Promise<AttachmentTransport>
): Promise<"sent" | "failed"> {
  if (entry.op === "delete") {
    if (isLabelJunction(table)) {
      // Baris sudah hilang lokal; pasangan (entitas, label) untuk path DELETE disimpan trigger di payload.
      const path = labelJunctionDeletePath(table, entry.payload);
      if (path) await pushDelete(creds, path, null, fetchImpl);
    } else if (table !== "investment_accounts" && table !== "forex_accounts") {
      const body = entry.payload ? (JSON.parse(entry.payload) as Record<string, unknown>) : null;
      await pushDelete(creds, `${DELETE_PATH[table]}/${encodeURIComponent(entry.row_id)}`, body, fetchImpl);
    }
    await removeIfUnchanged(db, entry, null);
    return "sent";
  }

  if (table === "transaction_attachments") return pushAttachment(db, creds, entry, await getTransport());

  const request = await buildPushRequest(db, table, entry.row_id);
  if (!request) {
    // Baris sudah tidak ada, atau belum boleh dikirim (debts/purchases tanpa transaksi): tidak ada yang dikirim.
    await removeIfUnchanged(db, entry, null);
    return "sent";
  }

  const result = await pushUpsert(creds, request.path, request.body, fetchImpl);
  if (result.status === "rejected") {
    await markFailed(db, entry, `rejected: ${result.reason}`);
    await logRejected(db, "push", entry.table_name, entry.row_id, result.reason);
    return "failed";
  }
  await clearRejected(db, "push", entry.table_name, entry.row_id);
  await removeIfUnchanged(db, entry, request.body);
  return "sent";
}

let inFlight: Promise<FlushResult> | null = null;

// Kirim seluruh antrean. Satu flush pada satu waktu: pemanggilan saat flush berjalan ikut menunggu hasil yang sama.
// Gagal jaringan menghentikan putaran (sisanya dicoba lagi nanti); error HTTP lain hanya menandai entry itu.
export function flushPushQueue(
  db: SQLiteDatabase,
  creds: CloudSyncCredentials,
  fetchImpl?: FetchLike,
  transport?: AttachmentTransport,
  options: FlushOptions = {}
): Promise<FlushResult> {
  if (inFlight) return inFlight;
  inFlight = run(db, creds, fetchImpl, transport, options).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(
  db: SQLiteDatabase,
  creds: CloudSyncCredentials,
  fetchImpl?: FetchLike,
  transport?: AttachmentTransport,
  options: FlushOptions = {}
): Promise<FlushResult> {
  const getTransport = async () => transport ?? loadDefaultAttachmentTransport();
  const entries = await db.getAllAsync<QueueEntry>(
    "SELECT id, table_name, row_id, op, payload FROM cloud_sync_queue WHERE attempts < ? ORDER BY id",
    [options.includeExhausted ? Number.MAX_SAFE_INTEGER : MAX_AUTO_ATTEMPTS]
  );
  const result: FlushResult = { sent: 0, failed: 0, aborted: false };

  for (const entry of sortEntries(entries.filter((candidate) => isPushTable(candidate.table_name)))) {
    try {
      const outcome = await pushEntry(db, creds, entry, entry.table_name as PushTable, fetchImpl, getTransport);
      result[outcome]++;
    } catch (error) {
      await markFailed(db, entry, error instanceof Error ? error.message : String(error));
      result.failed++;
      if (!(error instanceof WorkerRequestError)) {
        result.aborted = true;
        break;
      }
    }
  }
  return result;
}
