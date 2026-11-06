import type { SQLiteDatabase } from "expo-sqlite";
import type { LabelFormOutput } from "./form/schema";

// Case-insensitive supaya "Liburan" dan "liburan" tidak jadi dua label.
export async function isLabelNameTaken(
  db: SQLiteDatabase,
  { name, scope }: LabelFormOutput,
  excludeId?: string
) {
  const row = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM labels WHERE scope = ? AND LOWER(name) = LOWER(?) AND id <> ?`,
    [scope, name, excludeId ?? ""]
  );
  return row !== null;
}

export const DUPLICATE_LABEL_MESSAGE = "Label dengan nama ini sudah ada di scope yang sama.";
