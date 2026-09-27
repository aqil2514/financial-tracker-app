"use client";

import { useState } from "react";

import type { SyncRange, UseSyncFromDraftOutput } from "../interfaces";

/**
 * State "Periode Sync" — murni `useState` lokal, TIDAK persisten
 * (tidak disimpan ke `settings`, hilang tiap pindah tab/tutup app).
 * Sync satu-satunya adalah MANUAL: user isi rentang setiap kali mau
 * sync/preview, tidak ada titik lanjut otomatis yang perlu diingat
 * lintas sesi (beda dari auto-sync lama yang sudah dihapus total,
 * lihat handover 2026-09-26).
 */
export function useSyncFromDraft(): UseSyncFromDraftOutput {
  const [range, setRange] = useState<SyncRange>({ from: "", to: null });

  return { range, setRange };
}
