import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { usePathname } from "expo-router";
import { useDatabase } from "@/lib/database";
import { resolveCredentials } from "./resolve-credentials";
import { createSyncController, isFormRoute, type SyncSnapshot } from "./sync-controller";
import type { CloudSyncCredentials } from "./types";

const PUSH_POLL_MS = 5_000;

type CloudSyncContextValue = {
  snapshot: SyncSnapshot;
  // Sync penuh manual (kirim lalu tarik), mengabaikan interval minimum dan backoff.
  syncNow: () => Promise<boolean>;
  // Panggil setelah URL/token diubah supaya kredensial yang di-cache dibaca ulang.
  reloadConfig: () => void;
  refreshPending: () => Promise<void>;
};

const initialSnapshot: SyncSnapshot = { status: "off", pending: 0, lastSyncAt: null, lastError: null };

const CloudSyncContext = createContext<CloudSyncContextValue | null>(null);

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const db = useDatabase();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const [snapshot, setSnapshot] = useState<SyncSnapshot>(initialSnapshot);
  const credentialsRef = useRef<{ value: CloudSyncCredentials | null } | null>(null);

  const controller = useMemo(
    () =>
      createSyncController({
        db,
        getCredentials: async () => {
          // Token ada di SecureStore (Keystore): dibaca sekali, bukan tiap polling.
          if (!credentialsRef.current) credentialsRef.current = { value: await resolveCredentials(db) };
          return credentialsRef.current.value;
        },
        canPull: () => !isFormRoute(pathnameRef.current),
        onChange: setSnapshot,
      }),
    [db]
  );

  useEffect(() => {
    void controller.onAppActive();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void controller.onAppActive();
    });
    const interval = setInterval(() => {
      if (AppState.currentState === "active") void controller.pushIfPending();
    }, PUSH_POLL_MS);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [controller]);

  const reloadConfig = useCallback(() => {
    credentialsRef.current = null;
  }, []);

  const value = useMemo<CloudSyncContextValue>(
    () => ({ snapshot, syncNow: controller.syncNow, reloadConfig, refreshPending: controller.refreshPending }),
    [snapshot, controller, reloadConfig]
  );

  return <CloudSyncContext.Provider value={value}>{children}</CloudSyncContext.Provider>;
}

export function useCloudSync(): CloudSyncContextValue {
  const context = useContext(CloudSyncContext);
  if (!context) throw new Error("useCloudSync harus dipakai di dalam CloudSyncProvider");
  return context;
}
