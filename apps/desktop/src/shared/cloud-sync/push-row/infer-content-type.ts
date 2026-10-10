const EXTENSION_CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
};

export function inferContentType(filePath: string): string | null {
  const ext = filePath.split(".").pop()?.toLowerCase();
  return ext ? (EXTENSION_CONTENT_TYPE[ext] ?? null) : null;
}
