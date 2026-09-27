import { Dispatch, SetStateAction } from "react";

/** `to: null` berarti sync HANYA untuk tanggal `from` itu sendiri (1
 * hari) — BUKAN "dari `from` sampai hari ini" (semantik lama yang
 * sudah dihapus bersama auto-sync, lihat handover 2026-09-26). */
export type SyncRange = { from: string; to: string | null };

export interface UseSyncFromDraftOutput {
  range: SyncRange;
  setRange: Dispatch<SetStateAction<SyncRange>>;
}
