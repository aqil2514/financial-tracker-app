import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { Stack } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDatabase } from "@/lib/database";
import {
  clearSyncToken,
  enqueueAllRows,
  flushPushQueue,
  getSyncState,
  getSyncToken,
  runAttachmentPull,
  runPull,
  setSyncToken,
  useCloudSync,
  setWorkerUrl,
} from "@/shared/cloud-sync";
import type { SyncSnapshot } from "@/shared/cloud-sync/sync-controller";
import { workerRequest } from "@/shared/cloud-sync/worker-client";

type Status = { pending: number; rejected: number };
type RejectedEntry = { table_name: string; direction: string; total: number; reason: string; sample: string };
type FailedEntry = { id: number; table_name: string; row_id: string; attempts: number; last_error: string };

function statusLabel(snapshot: SyncSnapshot): string {
  if (snapshot.status === "off") return "Sync otomatis mati (URL dan token belum diisi).";
  if (snapshot.status === "syncing") return "Sedang menyinkronkan...";
  if (snapshot.status === "error") return `Gagal: ${snapshot.lastError ?? "tidak diketahui"}. Dicoba lagi otomatis.`;
  const last = snapshot.lastSyncAt
    ? `Terakhir ${new Date(snapshot.lastSyncAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
    : "Belum pernah sync";
  return `${last}. Sync otomatis saat app dibuka dan setelah perubahan.`;
}

function ActionButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      className="items-center rounded-md border border-neutral-300 px-3 py-2.5 active:bg-neutral-100 disabled:opacity-50"
      onPress={onPress}
      disabled={disabled}
    >
      <Text className="text-neutral-900">{label}</Text>
    </Pressable>
  );
}

export default function SettingsPage() {
  const db = useDatabase();
  const { snapshot, reloadConfig, refreshPending } = useCloudSync();
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<Status>({ pending: 0, rejected: 0 });
  const [failed, setFailed] = useState<FailedEntry[]>([]);
  const [rejectedGroups, setRejectedGroups] = useState<RejectedEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const refreshStatus = useCallback(async () => {
    const pending = await db.getFirstAsync<{ total: number }>("SELECT COUNT(*) AS total FROM cloud_sync_queue");
    const rejected = await db.getFirstAsync<{ total: number }>("SELECT COUNT(*) AS total FROM cloud_sync_rejected_log");
    setStatus({ pending: pending?.total ?? 0, rejected: rejected?.total ?? 0 });
    setRejectedGroups(
      await db.getAllAsync<RejectedEntry>(
        `SELECT table_name, direction, COUNT(*) AS total, reason, MIN(row_id) AS sample
         FROM cloud_sync_rejected_log GROUP BY table_name, direction, reason ORDER BY total DESC LIMIT 15`
      )
    );
    setFailed(
      await db.getAllAsync<FailedEntry>(
        "SELECT id, table_name, row_id, attempts, last_error FROM cloud_sync_queue WHERE last_error IS NOT NULL ORDER BY id LIMIT 20"
      )
    );
  }, [db]);

  useEffect(() => {
    async function load() {
      const state = await getSyncState(db);
      setUrl(state.workerUrl ?? "");
      setToken((await getSyncToken()) ?? "");
      await refreshStatus();
    }
    load();
  }, [db, refreshStatus]);

  async function save() {
    const trimmedUrl = url.trim();
    const trimmedToken = token.trim();
    await setWorkerUrl(db, trimmedUrl || null);
    if (trimmedToken) await setSyncToken(trimmedToken);
    else await clearSyncToken();
    reloadConfig();
  }

  async function run(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } catch (error) {
      Alert.alert("Gagal", error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      await refreshStatus();
      await refreshPending();
    }
  }

  const credentials = () => {
    const workerUrl = url.trim();
    const bearer = token.trim();
    if (!workerUrl || !bearer) throw new Error("URL Worker dan token wajib diisi.");
    return { workerUrl, token: bearer };
  };

  return (
    <>
      <Stack.Screen options={{ title: "Settings" }} />
      <KeyboardAwareScrollView className="flex-1 bg-white" contentContainerClassName="gap-4 p-4 pb-12" bottomOffset={20}>
        <Text className="text-lg font-semibold text-neutral-900">Sinkronisasi cloud</Text>
        <Text className={`text-sm ${snapshot.status === "error" ? "text-red-600" : "text-neutral-600"}`}>
          {statusLabel(snapshot)}
        </Text>

        <View className="gap-2">
          <Text className="text-sm font-medium text-neutral-700">URL Worker</Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://nama-worker.workers.dev"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            className="rounded-md border border-neutral-300 px-3 py-2 text-neutral-900"
          />
        </View>

        <View className="gap-2">
          <Text className="text-sm font-medium text-neutral-700">Token</Text>
          <TextInput
            value={token}
            onChangeText={setToken}
            placeholder="Token sync (sama dengan token desktop)"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            className="rounded-md border border-neutral-300 px-3 py-2 text-neutral-900"
          />
          <Text className="text-xs text-neutral-500">Disimpan terenkripsi di perangkat ini, tidak ikut database.</Text>
        </View>

        <ActionButton
          label="Simpan"
          disabled={busy}
          onPress={() =>
            run(async () => {
              await save();
              Alert.alert("Tersimpan", "Pengaturan sync disimpan.");
            })
          }
        />

        <ActionButton
          label="Tes koneksi"
          disabled={busy}
          onPress={() =>
            run(async () => {
              await save();
              await workerRequest(credentials(), "/auth/verify");
              Alert.alert("Berhasil", "Worker dapat dijangkau dan token diterima.");
            })
          }
        />

        <View className="gap-2 rounded-md bg-neutral-50 p-3">
          <Text className="text-neutral-900">Menunggu dikirim: {status.pending}</Text>
          <Text className="text-neutral-900">Ditolak atau dilewati: {status.rejected}</Text>
        </View>

        {rejectedGroups.length > 0 && (
          <View className="gap-2 rounded-md bg-amber-50 p-3">
            <Text className="font-medium text-amber-800">Ditolak (dikelompokkan per alasan)</Text>
            {rejectedGroups.map((group) => (
              <View key={`${group.table_name}-${group.direction}-${group.reason}`}>
                <Text className="text-sm text-neutral-900">
                  {group.table_name} · {group.direction} · {group.total} baris · contoh {group.sample.slice(0, 8)}
                </Text>
                <Text className="text-xs text-amber-800">{group.reason}</Text>
              </View>
            ))}
          </View>
        )}

        {failed.length > 0 && (
          <View className="gap-2 rounded-md bg-red-50 p-3">
            <Text className="font-medium text-red-700">Entry gagal</Text>
            {failed.map((entry) => (
              <View key={entry.id}>
                <Text className="text-sm text-neutral-900">
                  {entry.table_name} · {entry.row_id.slice(0, 8)} · percobaan {entry.attempts}
                </Text>
                <Text className="text-xs text-red-700">{entry.last_error}</Text>
              </View>
            ))}
          </View>
        )}

        {failed.length > 0 && (
          <ActionButton
            label="Buang entry gagal dari antrean"
            disabled={busy}
            onPress={() =>
              Alert.alert(
                "Buang entry gagal?",
                "Entry yang gagal terus akan dihapus dari antrean dan tidak dikirim lagi. Data lokalnya tetap ada di HP, hanya tidak disinkronkan ke cloud. Lanjutkan?",
                [
                  { text: "Batal", style: "cancel" },
                  {
                    text: "Buang",
                    style: "destructive",
                    onPress: () =>
                      run(async () => {
                        await db.withTransactionAsync(async () => {
                          await db.runAsync(
                            `DELETE FROM cloud_sync_rejected_log WHERE direction = 'push' AND EXISTS (
                               SELECT 1 FROM cloud_sync_queue q WHERE q.last_error IS NOT NULL
                                 AND q.table_name = cloud_sync_rejected_log.table_name AND q.row_id = cloud_sync_rejected_log.row_id)`
                          );
                          await db.runAsync("DELETE FROM cloud_sync_queue WHERE last_error IS NOT NULL");
                        });
                      }),
                  },
                ]
              )
            }
          />
        )}

        <ActionButton
          label="Antrekan semua data"
          disabled={busy}
          onPress={() =>
            Alert.alert(
              "Antrekan SEMUA data?",
              "Ini memasukkan setiap baris di HP ke antrean kirim, termasuk data yang baru ditarik dari cloud (bisa ribuan baris, dan hampir semuanya akan diabaikan Worker). Biasanya hanya perlu SEKALI untuk data yang dibuat sebelum sync aktif. Lanjutkan?",
              [
                { text: "Batal", style: "cancel" },
                {
                  text: "Antrekan",
                  onPress: () =>
                    run(async () => {
                      const added = await enqueueAllRows(db);
                      Alert.alert("Selesai", `${added} baris ditambahkan ke antrean. Tekan Sync sekarang untuk mengirim.`);
                    }),
                },
              ]
            )
          }
        />

        <ActionButton
          label="Sync sekarang (kirim lalu tarik)"
          disabled={busy}
          onPress={() =>
            run(async () => {
              await save();
              const sent = await flushPushQueue(db, credentials(), undefined, undefined, { includeExhausted: true });
              if (sent.aborted) {
                Alert.alert("Berhenti", "Jaringan bermasalah saat mengirim; penarikan dibatalkan.");
                return;
              }
              const pulled = await runPull(db, credentials());
              const attachments = await runAttachmentPull(db, credentials());
              Alert.alert(
                "Selesai",
                `Terkirim ${sent.sent}, gagal ${sent.failed}. Ditarik ${pulled.applied}, ditolak ${pulled.rejected}, dilewati ${pulled.skipped}${
                  pulled.checkpointAdvanced ? "" : " (checkpoint tidak maju, akan dicoba ulang)"
                }. Lampiran: ${attachments.applied} masuk, ${attachments.rejected} gagal, ${attachments.skipped} dilewati.`
              );
            })
          }
        />

        <ActionButton
          label="Kirim sekarang"
          disabled={busy}
          onPress={() =>
            run(async () => {
              await save();
              const result = await flushPushQueue(db, credentials(), undefined, undefined, { includeExhausted: true });
              Alert.alert(
                "Selesai",
                `Terkirim ${result.sent}, gagal ${result.failed}${result.aborted ? " (berhenti: jaringan bermasalah)" : ""}.`
              );
            })
          }
        />
      </KeyboardAwareScrollView>
    </>
  );
}
