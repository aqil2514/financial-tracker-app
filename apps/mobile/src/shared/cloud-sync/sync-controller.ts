import type { SQLiteDatabase } from "expo-sqlite";
import type { AttachmentTransport } from "./attachment-transport-types";
import { flushPushQueue, MAX_AUTO_ATTEMPTS } from "./flush-push-queue";
import { runAttachmentPull } from "./pull-attachments";
import { runPull } from "./run-pull";
import type { CloudSyncCredentials } from "./types";
import type { FetchLike } from "./worker-client";

export type SyncStatus = "off" | "idle" | "syncing" | "error";

export type SyncSnapshot = {
  status: SyncStatus;
  pending: number;
  lastSyncAt: number | null;
  lastError: string | null;
};

type Deps = {
  db: SQLiteDatabase;
  getCredentials: () => Promise<CloudSyncCredentials | null>;
  // false saat pengguna sedang di layar form: pull menyalakan penanda gema global yang menahan antrean.
  canPull: () => boolean;
  onChange?: (snapshot: SyncSnapshot) => void;
  fetchImpl?: FetchLike;
  transport?: AttachmentTransport;
  now?: () => number;
};

const APP_ACTIVE_MIN_INTERVAL_MS = 15_000;
const ERROR_BACKOFF_MS = 30_000;

// Otak sync otomatis, tanpa React supaya bisa diuji dengan SQLite asli: kapan kirim, kapan tarik, backoff saat gagal.
export function createSyncController({
  db,
  getCredentials,
  canPull,
  onChange,
  fetchImpl,
  transport,
  now = Date.now,
}: Deps) {
  let snapshot: SyncSnapshot = { status: "off", pending: 0, lastSyncAt: null, lastError: null };
  let busy = false;
  let lastAttemptAt = 0;
  let backoffUntil = 0;

  function update(next: Partial<SyncSnapshot>) {
    snapshot = { ...snapshot, ...next };
    onChange?.(snapshot);
  }

  async function countPending(): Promise<number> {
    // Entry yang sudah habis percobaan otomatis tidak dihitung "menunggu": tidak akan terkirim sendiri.
    const row = await db.getFirstAsync<{ total: number }>(
      "SELECT COUNT(*) AS total FROM cloud_sync_queue WHERE attempts < ?",
      [MAX_AUTO_ATTEMPTS]
    );
    return row?.total ?? 0;
  }

  async function refreshPending() {
    const pending = await countPending();
    if (pending !== snapshot.pending) update({ pending });
  }

  function fail(error: unknown) {
    backoffUntil = now() + ERROR_BACKOFF_MS;
    update({ status: "error", lastError: error instanceof Error ? error.message : String(error) });
  }

  // Dipakai untuk "sync penuh": kirim dulu, lalu tarik (kalau boleh). Mengembalikan false kalau dilewati.
  // `busy` diklaim SEBELUM await pertama, kalau tidak dua panggilan bersamaan sama-sama lolos.
  async function syncAll(includeExhausted = false): Promise<boolean> {
    if (busy) return false;
    busy = true;
    try {
      const creds = await getCredentials();
      if (!creds) {
        update({ status: "off", lastError: null });
        return false;
      }

      lastAttemptAt = now();
      update({ status: "syncing", lastError: null });
      const sent = await flushPushQueue(db, creds, fetchImpl, transport, { includeExhausted });
      if (sent.aborted) {
        fail(new Error("Jaringan bermasalah saat mengirim"));
        return true;
      }
      if (canPull()) {
        await runPull(db, creds, fetchImpl);
        // Attachment butuh transaksi induknya sudah ada lokal, jadi SETELAH pull data.
        await runAttachmentPull(db, creds, fetchImpl, transport);
      }
      update({ status: "idle", lastSyncAt: now(), pending: await countPending() });
      return true;
    } catch (error) {
      fail(error);
      return true;
    } finally {
      busy = false;
    }
  }

  // Dipanggil berkala: kirim saja kalau ada perubahan menunggu. Tidak menarik.
  async function pushIfPending(): Promise<void> {
    if (busy || now() < backoffUntil) return;
    busy = true;
    try {
      const creds = await getCredentials();
      if (!creds) {
        if (snapshot.status !== "off") update({ status: "off" });
        return;
      }
      const pending = await countPending();
      if (pending !== snapshot.pending) update({ pending });
      if (pending === 0) return;

      update({ status: "syncing" });
      const sent = await flushPushQueue(db, creds, fetchImpl, transport);
      if (sent.aborted) {
        fail(new Error("Jaringan bermasalah saat mengirim"));
        return;
      }
      update({ status: "idle", lastSyncAt: now(), lastError: null, pending: await countPending() });
    } catch (error) {
      fail(error);
    } finally {
      busy = false;
    }
  }

  // App kembali aktif: sync penuh, tapi tidak lebih sering dari batas minimum dan tidak saat backoff.
  async function onAppActive(): Promise<void> {
    if (now() - lastAttemptAt < APP_ACTIVE_MIN_INTERVAL_MS || now() < backoffUntil) return;
    await syncAll();
  }

  // Aksi manual mengabaikan batas minimum dan backoff.
  async function syncNow(): Promise<boolean> {
    backoffUntil = 0;
    return syncAll(true);
  }

  return { getSnapshot: () => snapshot, refreshPending, pushIfPending, onAppActive, syncNow };
}

export type SyncController = ReturnType<typeof createSyncController>;

// Layar yang berisi form: pull ditunda di sini (lihat canPull).
const FORM_ROUTE = /\/(new|edit|edit-purchase|purchase|sell|settle-sale|write-off|record|move)$/;

export function isFormRoute(pathname: string): boolean {
  return FORM_ROUTE.test(pathname);
}
