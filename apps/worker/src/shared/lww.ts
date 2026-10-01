// Last-write-wins helper, dipakai SEMUA modul tulis (lihat keputusan
// "Strategi conflict resolution" di docs/todos/plan/cloud-sync.md).
// Format timestamp TEXT seragam di seluruh Worker: "YYYY-MM-DD HH:mm:ss"
// (UTC, dari `new Date().toISOString().slice(0, 19).replace("T", " ")`)
// -- zero-padded shg bisa dibandingkan leksikografis sbg string biasa,
// TIDAK perlu parse ke Date dulu.
const UPDATED_AT_FORMAT = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export function isValidUpdatedAt(value: unknown): value is string {
  return typeof value === "string" && UPDATED_AT_FORMAT.test(value);
}

export function nowText(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

// Caller (PC/MCP) KIRIM `updatedAt` opsional -- kalau tidak dikirim
// (client lama/belum update), Worker pakai now() sendiri (SELALU
// dianggap "paling baru", backward compatible dgn perilaku sebelum LWW
// ada). Kalau dikirim, dipakai utk compare terhadap row existing.
export function resolveIncomingUpdatedAt(payloadUpdatedAt: string | undefined): string {
  return payloadUpdatedAt ?? nowText();
}

export type LwwDecision = { outcome: "proceed"; updatedAt: string } | { outcome: "stale" };

// Bandingkan `updatedAt` masuk terhadap row existing -- menang (proceed)
// kalau LEBIH BARU (strict >, bukan >=): row existing yg SAMA persis
// timestamp-nya dianggap TIDAK berubah, tidak perlu ditulis ulang.
// `existingUpdatedAt` null berarti baris belum ada sama sekali (CREATE
// murni, selalu proceed).
export function decideLww(
  incomingUpdatedAt: string,
  existingUpdatedAt: string | null
): LwwDecision {
  if (existingUpdatedAt === null) return { outcome: "proceed", updatedAt: incomingUpdatedAt };
  if (incomingUpdatedAt > existingUpdatedAt) return { outcome: "proceed", updatedAt: incomingUpdatedAt };
  return { outcome: "stale" };
}
