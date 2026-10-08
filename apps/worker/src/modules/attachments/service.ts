import type { Env } from "../../shared/env";
import type { SyncSource } from "../../shared/auth";
import { nowText, resolveIncomingUpdatedAt, decideLww } from "../../shared/lww";

type AttachmentRow = {
  id: string;
  transaction_id: string;
  r2_key: string;
  content_type: string | null;
  size_bytes: number | null;
  updated_at: string | null;
  deleted_at: string | null;
};

export type UploadAttachmentInput = {
  id: string;
  transactionId: string;
  bytes: ArrayBuffer;
  contentType: string | null;
  updatedAt?: string;
};

export type UploadAttachmentResult = { status: "ok"; id: string } | { status: "stale" };

function buildR2Key(transactionId: string, id: string, contentType: string | null): string {
  const ext = contentType?.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "bin";
  return `${transactionId}/${id}.${ext}`;
}

// UPSERT dgn LWW, pola SAMA dgn contacts/service.ts upsertContact --
// BEDA krn ada side-effect ke R2 (bukan cuma D1): upload binary ke R2
// SEBELUM insert row D1, supaya TIDAK ada row D1 yg menunjuk ke object
// R2 yg gagal/belum ter-upload (urutan ini SENGAJA, kebalikan dari
// "tulis row dulu baru proses lain" krn di sini R2 adalah SUMBER
// kebenaran isi file -- row D1 yg orphan tanpa object lebih buruk drpd
// object tanpa row, yg masih bisa di cleanup belakangan).
export async function uploadAttachment(
  env: Env,
  input: UploadAttachmentInput,
  syncSource: SyncSource
): Promise<UploadAttachmentResult> {
  const existing = await env.DB.prepare(
    "SELECT updated_at, r2_key FROM transaction_attachments WHERE id = ?1"
  )
    .bind(input.id)
    .first<{ updated_at: string | null; r2_key: string }>();

  const incomingUpdatedAt = resolveIncomingUpdatedAt(input.updatedAt);
  const decision = decideLww(incomingUpdatedAt, existing?.updated_at ?? null);
  if (decision.outcome === "stale") return { status: "stale" };

  const r2Key = existing?.r2_key ?? buildR2Key(input.transactionId, input.id, input.contentType);
  await env.ATTACHMENTS_BUCKET.put(r2Key, input.bytes, {
    httpMetadata: input.contentType ? { contentType: input.contentType } : undefined,
  });

  if (!existing) {
    const now = nowText();
    await env.DB.prepare(
      `INSERT INTO transaction_attachments
         (id, transaction_id, r2_key, content_type, size_bytes, created_at, updated_at, sync_source)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    )
      .bind(
        input.id,
        input.transactionId,
        r2Key,
        input.contentType,
        input.bytes.byteLength,
        now,
        decision.updatedAt,
        syncSource
      )
      .run();
  } else {
    await env.DB.prepare(
      `UPDATE transaction_attachments
       SET transaction_id = ?1, content_type = ?2, size_bytes = ?3, updated_at = ?4, deleted_at = NULL
       WHERE id = ?5`
    )
      .bind(input.transactionId, input.contentType, input.bytes.byteLength, decision.updatedAt, input.id)
      .run();
  }

  return { status: "ok", id: input.id };
}

export type GetAttachmentResult =
  | { status: "ok"; bytes: ArrayBuffer; contentType: string | null }
  | { status: "not_found" };

// Dipakai desktop (PULL sync, download ke disk lokal) DAN MCP/Claude
// (baca langsung isi gambar). Row soft-deleted dianggap not_found --
// object R2-nya sendiri mungkin sudah di-hard-delete juga (lihat
// deleteAttachment), jadi tidak ada bedanya scr hasil.
export async function getAttachment(env: Env, id: string): Promise<GetAttachmentResult> {
  const row = await env.DB.prepare(
    "SELECT r2_key, content_type FROM transaction_attachments WHERE id = ?1 AND deleted_at IS NULL"
  )
    .bind(id)
    .first<{ r2_key: string; content_type: string | null }>();
  if (!row) return { status: "not_found" };

  const object = await env.ATTACHMENTS_BUCKET.get(row.r2_key);
  if (!object) return { status: "not_found" };

  return { status: "ok", bytes: await object.arrayBuffer(), contentType: row.content_type };
}

export type AttachmentListItem = {
  id: string;
  transactionId: string;
  contentType: string | null;
  sizeBytes: number | null;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type AttachmentListResponse = { checkpoint: string; attachments: AttachmentListItem[] };

// Pola SAMA dgn modules/sync/service.ts getSyncSnapshot -- `since` null
// berarti full snapshot (first-sync), terisi berarti cuma baris yg
// `updated_at > since`. TIDAK mengembalikan bytes file, cuma metadata
// -- desktop panggil GET /attachments/:id TERPISAH per baris yg filenya
// belum ada lokal (lihat docs/todos/plan/attachment-r2-sync.md "Sisi
// desktop: push & pull"). `checkpoint` diambil SEBELUM query jalan (sama
// alasan dgn modules/sync/service.ts) supaya baris yg berubah PAS SAAT
// query berjalan tetap tercakup di pull berikutnya.
export async function listAttachmentsSince(env: Env, since: string | null): Promise<AttachmentListResponse> {
  const checkpoint = nowText();
  const filter = since !== null ? "WHERE updated_at > ?1" : "";
  const bind = since !== null ? [since] : [];

  const result = await env.DB.prepare(
    `SELECT id, transaction_id, content_type, size_bytes, updated_at, deleted_at
     FROM transaction_attachments ${filter}`
  )
    .bind(...bind)
    .all<AttachmentRow>();

  return {
    checkpoint,
    attachments: result.results.map((r) => ({
      id: r.id,
      transactionId: r.transaction_id,
      contentType: r.content_type,
      sizeBytes: r.size_bytes,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
    })),
  };
}

export type DeleteAttachmentResult = { status: "ok" } | { status: "not_found" };

// Soft-delete row D1 (pola LWW sama dgn tabel lain) SEKALIGUS
// hard-delete object R2 -- R2 tidak punya konsep soft-delete sendiri,
// jadi object fisik dihapus permanen saat ini, TIDAK bisa di-undo lewat
// LWW spt row D1 (beda dari tabel lain yg "hidup lagi" kalau sisi lain
// edit dgn updatedAt lebih baru -- attachment yg sudah dihapus TIDAK
// bisa "hidup lagi" krn bytes-nya sudah benar-benar hilang dari R2).
export async function deleteAttachment(env: Env, id: string): Promise<DeleteAttachmentResult> {
  const existing = await env.DB.prepare(
    "SELECT r2_key FROM transaction_attachments WHERE id = ?1 AND deleted_at IS NULL"
  )
    .bind(id)
    .first<{ r2_key: string }>();
  if (!existing) return { status: "not_found" };

  await env.ATTACHMENTS_BUCKET.delete(existing.r2_key);

  const now = nowText();
  await env.DB.prepare("UPDATE transaction_attachments SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
    .bind(now, id)
    .run();

  return { status: "ok" };
}
