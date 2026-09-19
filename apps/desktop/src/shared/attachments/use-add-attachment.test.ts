import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

const { saveFile } = await import("./use-add-attachment");

beforeEach(() => {
  invokeMock.mockReset();
});

describe("saveFile", () => {
  it("memanggil save_attachment_from_path untuk input source path", async () => {
    invokeMock.mockResolvedValueOnce("/app-data/attachments/uuid.png");

    const result = await saveFile(
      { source: "path", path: "/home/user/photo.png" },
      null
    );

    expect(invokeMock).toHaveBeenCalledWith("save_attachment_from_path", {
      sourcePath: "/home/user/photo.png",
      targetDir: null,
    });
    expect(result).toBe("/app-data/attachments/uuid.png");
  });

  it("meneruskan targetDir kustom ke save_attachment_from_path", async () => {
    invokeMock.mockResolvedValueOnce("/custom/uuid.png");

    await saveFile({ source: "path", path: "/home/user/photo.png" }, "/custom");

    expect(invokeMock).toHaveBeenCalledWith("save_attachment_from_path", {
      sourcePath: "/home/user/photo.png",
      targetDir: "/custom",
    });
  });

  it("memanggil save_attachment_bytes untuk input source bytes, mengonversi Uint8Array ke array biasa", async () => {
    invokeMock.mockResolvedValueOnce("/app-data/attachments/clipboard.png");

    const bytes = new Uint8Array([1, 2, 3]);
    const result = await saveFile(
      { source: "bytes", bytes, fileName: "clipboard.png" },
      null
    );

    expect(invokeMock).toHaveBeenCalledWith("save_attachment_bytes", {
      bytes: [1, 2, 3],
      originalName: "clipboard.png",
      targetDir: null,
    });
    expect(result).toBe("/app-data/attachments/clipboard.png");
  });

  it("bytes yang diteruskan adalah Array biasa, bukan Uint8Array (kompatibel dengan serialisasi invoke)", async () => {
    invokeMock.mockResolvedValueOnce("/x.png");

    await saveFile({ source: "bytes", bytes: new Uint8Array([9, 8, 7]), fileName: "x.png" }, null);

    const callArgs = invokeMock.mock.calls[0][1] as { bytes: unknown };
    expect(Array.isArray(callArgs.bytes)).toBe(true);
    expect(callArgs.bytes).not.toBeInstanceOf(Uint8Array);
  });
});
