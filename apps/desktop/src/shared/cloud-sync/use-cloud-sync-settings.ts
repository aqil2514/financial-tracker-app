"use client";

import { useQuery } from "@tanstack/react-query";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";

const ENABLED_KEY = "cloud_sync_enabled";
const WORKER_URL_KEY = "cloud_sync_worker_url";
const TOKEN_KEY = "cloud_sync_token";
const LAST_CHECKPOINT_KEY = "cloud_sync_last_checkpoint";
// Checkpoint TERPISAH dari LAST_CHECKPOINT_KEY -- `GET /attachments?since=`
// py siklus `updated_at` sendiri (tabel `transaction_attachments` di D1,
// request terpisah dari `GET /sync`), lihat attachment-r2-sync.md.
// Menyamakan dgn checkpoint /sync akan salah kalau kedua request tidak
// selalu sukses bareng (satu gagal, satu berhasil -- checkpoint gabungan
// akan maju utk yang gagal juga).
const ATTACHMENTS_CHECKPOINT_KEY = "cloud_sync_attachments_checkpoint";

export const cloudSyncSettingsQueryKey = ["settings", "cloud-sync"];

/**
 * Kredensial + status fitur cloud sync (lihat
 * docs/todos/plan/mcp-server-cloud-mirror.md) — disimpan di tabel
 * `settings` key-value, pola SAMA dgn `use-retailku-settings.ts`.
 * Plaintext di SQLite lokal (keputusan sadar, SAMA alasannya dgn
 * `retailku_api_key` meski scope token ini lebih besar — lihat
 * dokumen di atas "Keamanan token").
 */
export type CloudSyncSettings = {
  enabled: boolean;
  workerUrl: string | null;
  token: string | null;
  /** Timestamp pull terakhir (format "YYYY-MM-DD HH:mm:ss", SAMA
   * dgn `updated_at` di Worker) -- dikirim sbg `?since=` pull
   * berikutnya. `null` berarti belum pernah pull sama sekali
   * (first sync, Worker akan balas full snapshot). */
  lastCheckpoint: string | null;
  /** Checkpoint TERPISAH utk `GET /attachments?since=` -- lihat
   * komentar ATTACHMENTS_CHECKPOINT_KEY di atas. */
  lastAttachmentsCheckpoint: string | null;
};

const SETTINGS_KEYS = [ENABLED_KEY, WORKER_URL_KEY, TOKEN_KEY, LAST_CHECKPOINT_KEY, ATTACHMENTS_CHECKPOINT_KEY];

export function useCloudSyncSettings() {
  return useQuery({
    queryKey: cloudSyncSettingsQueryKey,
    queryFn: async (): Promise<CloudSyncSettings> => {
      const db = await getDb();
      const rows = await db.select<{ key: string; value: string | null }[]>(
        `SELECT key, value FROM settings WHERE key IN (${SETTINGS_KEYS.map((_, i) => `$${i + 1}`).join(", ")})`,
        SETTINGS_KEYS
      );
      const get = (key: string) => rows.find((row) => row.key === key)?.value ?? null;
      return {
        enabled: get(ENABLED_KEY) === "1",
        workerUrl: get(WORKER_URL_KEY),
        token: get(TOKEN_KEY),
        lastCheckpoint: get(LAST_CHECKPOINT_KEY),
        lastAttachmentsCheckpoint: get(ATTACHMENTS_CHECKPOINT_KEY),
      };
    },
  });
}

/** Simpan toggle + kredensial (dipanggil dari form Settings). TIDAK
 * menyentuh `lastCheckpoint` -- itu field internal, diupdate otomatis
 * oleh logic pull (`useSetCloudSyncCheckpoint`), bukan oleh user. */
export function useSetCloudSyncSettings() {
  return useDbMutation({
    mutationFn: async (settings: { enabled: boolean; workerUrl: string | null; token: string | null }) => {
      const db = await getDb();
      const entries: [string, string | null][] = [
        [ENABLED_KEY, settings.enabled ? "1" : "0"],
        [WORKER_URL_KEY, settings.workerUrl],
        [TOKEN_KEY, settings.token],
      ];
      for (const [key, value] of entries) {
        await db.execute(
          `INSERT INTO settings (key, value) VALUES ($1, $2)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          [key, value]
        );
      }
    },
    invalidateKey: cloudSyncSettingsQueryKey,
    successMessage: "Pengaturan cloud sync berhasil disimpan",
    errorMessage: "Gagal menyimpan pengaturan cloud sync",
  });
}

/** Update checkpoint SETELAH pull berhasil -- dipanggil dari logic
 * pull (bukan dari UI Settings), TIDAK menampilkan toast (operasi
 * internal/background, bukan aksi user eksplisit). */
export function useSetCloudSyncCheckpoint() {
  return useDbMutation({
    mutationFn: async (checkpoint: string) => {
      const db = await getDb();
      await db.execute(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [LAST_CHECKPOINT_KEY, checkpoint]
      );
    },
    invalidateKey: cloudSyncSettingsQueryKey,
    successMessage: "",
    errorMessage: "Gagal menyimpan checkpoint sync",
    silent: true,
  });
}

/** Sama seperti `useSetCloudSyncCheckpoint`, checkpoint TERPISAH utk
 * `GET /attachments?since=` -- lihat komentar ATTACHMENTS_CHECKPOINT_KEY. */
export function useSetAttachmentsCheckpoint() {
  return useDbMutation({
    mutationFn: async (checkpoint: string) => {
      const db = await getDb();
      await db.execute(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [ATTACHMENTS_CHECKPOINT_KEY, checkpoint]
      );
    },
    invalidateKey: cloudSyncSettingsQueryKey,
    successMessage: "",
    errorMessage: "Gagal menyimpan checkpoint attachment",
    silent: true,
  });
}
