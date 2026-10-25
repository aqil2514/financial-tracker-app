import { v7 as uuidv7 } from "uuid";

// UUID v7 (bukan v4) — konsisten dengan desktop (lihat migrasi
// 0027_uuid_primary_keys.sql: 48-bit pertama = timestamp, supaya
// insert pattern index tetap "naik" seiring waktu, penting untuk
// multi-device sync yang direncanakan).
export function generateId(): string {
  return uuidv7();
}
