import { getDb } from "@/lib/db";
import type { LabelFormOutput } from "./label.schema";

// Tanpa membedakan huruf besar/kecil, sama dengan resolveLabelIds. Baris soft-deleted ikut dihitung karena
// UNIQUE (name, scope) di tabel tidak mengecualikannya.
export async function assertUniqueLabelName({ name, scope }: LabelFormOutput, excludeId?: string) {
  const db = await getDb();
  const rows = await db.select<{ id: string }[]>(
    "SELECT id FROM labels WHERE scope = $1 AND LOWER(name) = LOWER($2) AND id <> $3",
    [scope, name, excludeId ?? ""]
  );
  if (rows.length > 0) throw new Error("Label dengan nama ini sudah ada di scope yang sama");
}
