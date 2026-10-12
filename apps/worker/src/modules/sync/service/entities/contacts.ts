import type { Env } from "../../../../shared/env";

export type ContactRow = {
  id: string;
  name: string;
  note: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
};

type ContactDbRow = {
  id: string;
  name: string;
  note: string | null;
  updated_at: string | null;
  deleted_at: string | null;
};

export async function fetchContacts(env: Env, filter: string, bind: unknown[]): Promise<ContactRow[]> {
  const { results } = await env.DB.prepare(`SELECT id, name, note, updated_at, deleted_at FROM contacts ${filter}`)
    .bind(...bind)
    .all<ContactDbRow>();

  return results.map((r) => ({
    id: r.id,
    name: r.name,
    note: r.note,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}
