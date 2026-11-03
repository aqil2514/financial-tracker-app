const EXTENSION_CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
};

// Skema lokal tidak punya kolom content_type; diturunkan dari ekstensi file (sama dengan desktop).
export function inferContentType(filePath: string): string | null {
  const ext = filePath.split(".").pop()?.toLowerCase();
  return ext ? (EXTENSION_CONTENT_TYPE[ext] ?? null) : null;
}

export function extensionFromContentType(contentType: string | null): string {
  return contentType?.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "bin";
}
