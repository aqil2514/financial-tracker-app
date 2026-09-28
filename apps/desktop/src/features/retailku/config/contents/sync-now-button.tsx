"use client";

import { Button } from "@/components/ui/button";
import { useRetailkuSyncCashflowConfig } from "../context";

/** Tombol aksi utama "Sync Sekarang". */
export function SyncNowButton() {
  const { syncNow } = useRetailkuSyncCashflowConfig();
  const { canSync, handleSyncNow, isSyncing } = syncNow;

  return (
    <Button onClick={handleSyncNow} disabled={!canSync || isSyncing}>
      {isSyncing ? "Menyinkronkan..." : "Sync Sekarang"}
    </Button>
  );
}
