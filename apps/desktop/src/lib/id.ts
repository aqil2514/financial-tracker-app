import { uuidv7 } from "uuidv7";

/** Primary key baru untuk INSERT — UUID v7 (time-ordered), BUKAN
 * `crypto.randomUUID()` bawaan (cuma generate v4/acak murni). Konsisten
 * dengan ID hasil migrasi skema (`0027_uuid_primary_keys.sql`) dan modul
 * import Money Manager (Rust, `Uuid::now_v7()`) — lihat
 * docs/todos/plan/uuid-migration.md. */
export function newId(): string {
  return uuidv7();
}
