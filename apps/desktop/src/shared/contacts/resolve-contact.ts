import { getDb, type Contact } from "@/lib/db";
import { newId } from "@/lib/id";

/**
 * Mengubah nama kontak (hasil ketikan bebas dari form transaksi) menjadi
 * `contact_id`. Kalau nama itu cocok persis (case-insensitive) dengan
 * kontak yang sudah ada, pakai id itu — kalau tidak, buat kontak baru.
 * User sudah diberi warning fuzzy-match di form sebelum submit, jadi di
 * titik ini keputusan "pakai yang sudah ada atau buat baru" sudah final.
 */
export async function resolveContactId(name: string | null): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const db = await getDb();
  const existing = await db.select<Contact[]>(
    "SELECT * FROM contacts WHERE name = $1 COLLATE NOCASE LIMIT 1",
    [trimmed]
  );
  if (existing.length > 0) return existing[0].id;

  const id = newId();
  await db.execute("INSERT INTO contacts (id, name) VALUES ($1, $2)", [id, trimmed]);
  return id;
}
