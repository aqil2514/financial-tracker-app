// GET /sync?since= -- query param opsional. Kosong/tidak dikirim berarti
// first sync (full snapshot 7 tabel) -- lihat keputusan di
// docs/todos/plan/cloud-sync.md. Kalau dikirim, HARUS format TEXT
// "YYYY-MM-DD HH:mm:ss" sama persis dgn kolom `updated_at` (lihat
// shared/lww.ts) supaya perbandingan `updated_at > since` valid scr
// string leksikografis.
import { isValidUpdatedAt } from "../../shared/lww";

export function parseSinceParam(value: string | undefined): { valid: true; since: string | null } | { valid: false } {
  if (value === undefined || value === "") return { valid: true, since: null };
  if (!isValidUpdatedAt(value)) return { valid: false };
  return { valid: true, since: value };
}
