import type { Context } from "hono";
import type { AppContext } from "../../shared/auth";
import { isAttachmentUploadFields, parseSinceParam } from "./schema";
import { uploadAttachment, getAttachment, listAttachmentsSince, deleteAttachment } from "./service";

// Body multipart/form-data: field "file" (binary) + "id"/"transactionId"/
// "updatedAt" (string) -- BUKAN JSON krn ada file binary, lihat
// schema.ts.
export async function handlePostAttachment(c: Context<AppContext>) {
  const form = await c.req.parseBody().catch(() => null);
  if (!form) {
    return c.json({ error: "Invalid multipart form" }, 400);
  }

  const file = form.file;
  if (!(file instanceof File)) {
    return c.json({ error: "Missing 'file' field" }, 400);
  }

  const fields = {
    id: form.id,
    transactionId: form.transactionId,
    updatedAt: form.updatedAt === undefined ? undefined : form.updatedAt,
  };
  if (!isAttachmentUploadFields(fields)) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const result = await uploadAttachment(
    c.env,
    {
      id: fields.id,
      transactionId: fields.transactionId,
      bytes: await file.arrayBuffer(),
      contentType: file.type || null,
      updatedAt: fields.updatedAt as string | undefined,
    },
    c.get("syncSource")
  );

  if (result.status === "stale") {
    return c.json({ status: "ignored", id: fields.id });
  }
  return c.json({ status: "ok", id: result.id }, 201);
}

// Serve isi file langsung (bukan JSON) -- dipakai desktop (download saat
// pull sync) dan MCP/Claude (baca gambar langsung).
export async function handleGetAttachment(c: Context<AppContext>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing attachment id" }, 400);

  const result = await getAttachment(c.env, id);
  if (result.status === "not_found") {
    return c.json({ error: "Attachment not found" }, 404);
  }

  return new Response(result.bytes, {
    status: 200,
    headers: { "Content-Type": result.contentType ?? "application/octet-stream" },
  });
}

export async function handleListAttachments(c: Context<AppContext>) {
  const sinceParam = c.req.query("since");
  const parsed = parseSinceParam(sinceParam);
  if (!parsed.valid) {
    return c.json({ error: "Invalid 'since' format, expected 'YYYY-MM-DD HH:mm:ss'" }, 400);
  }

  const result = await listAttachmentsSince(c.env, parsed.since);
  return c.json(result, 200);
}

export async function handleDeleteAttachment(c: Context<AppContext>) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing attachment id" }, 400);

  const result = await deleteAttachment(c.env, id);
  if (result.status === "not_found") {
    return c.json({ error: "Attachment not found" }, 404);
  }
  return c.json({ status: "ok", id }, 200);
}
