import { describe, expect, it } from "vitest";
import { bytesToDataUrl, guessMimeType } from "./attachment-thumbnail";

describe("guessMimeType", () => {
  it("mendeteksi ekstensi png", () => {
    expect(guessMimeType("/path/to/photo.png")).toBe("image/png");
  });

  it("mendeteksi ekstensi webp", () => {
    expect(guessMimeType("photo.webp")).toBe("image/webp");
  });

  it("mendeteksi ekstensi gif", () => {
    expect(guessMimeType("photo.GIF")).toBe("image/gif");
  });

  it("fallback ke jpeg untuk ekstensi jpg/jpeg", () => {
    expect(guessMimeType("photo.jpg")).toBe("image/jpeg");
    expect(guessMimeType("photo.jpeg")).toBe("image/jpeg");
  });

  it("fallback ke jpeg untuk ekstensi tak dikenal", () => {
    expect(guessMimeType("photo.bin")).toBe("image/jpeg");
  });

  it("case-insensitive terhadap ekstensi", () => {
    expect(guessMimeType("photo.PNG")).toBe("image/png");
  });
});

describe("bytesToDataUrl", () => {
  it("menghasilkan data URL dengan mime type sesuai ekstensi file", () => {
    const bytes = [137, 80, 78, 71];
    const result = bytesToDataUrl(bytes, "photo.png");
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it("meng-encode bytes ke base64 dengan benar (byte kecil)", () => {
    // "AB" -> [65, 66] -> base64 "QUI="
    const result = bytesToDataUrl([65, 66], "note.jpg");
    expect(result).toBe("data:image/jpeg;base64,QUI=");
  });

  it("menghasilkan base64 identik untuk array kosong", () => {
    const result = bytesToDataUrl([], "empty.png");
    expect(result).toBe("data:image/png;base64,");
  });

  it("tetap benar untuk data yang melebihi satu chunk (CHUNK_SIZE)", () => {
    // Reduce per-karakter versi lama berisiko O(n^2)/salah pada input besar —
    // pastikan hasil chunked sama persis dengan encoding manual referensi.
    const size = 8192 * 2 + 137; // sengaja melewati beberapa batas chunk
    const bytes = Array.from({ length: size }, (_, i) => i % 256);

    const result = bytesToDataUrl(bytes, "big.png");

    const expectedBinary = String.fromCharCode(...bytes);
    const expectedBase64 = btoa(expectedBinary);
    expect(result).toBe(`data:image/png;base64,${expectedBase64}`);
  });
});
