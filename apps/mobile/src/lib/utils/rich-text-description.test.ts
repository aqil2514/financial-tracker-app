import { describe, expect, it } from "vitest";
import { descriptionToPlainText, plainTextToDescription } from "./rich-text-description";

const DESKTOP_DOC = JSON.stringify({
  type: "doc",
  content: [
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Stiker x 1 = Rp 20.000" }] },
          ],
        },
      ],
    },
    { type: "paragraph", content: [{ type: "text", text: "Total: Rp 20.000" }] },
  ],
});

describe("descriptionToPlainText", () => {
  it("mengubah TipTap JSON jadi teks dengan bullet", () => {
    expect(descriptionToPlainText(DESKTOP_DOC)).toBe("- Stiker x 1 = Rp 20.000\nTotal: Rp 20.000");
  });

  it("plain text lama dikembalikan apa adanya", () => {
    expect(descriptionToPlainText("catatan biasa")).toBe("catatan biasa");
  });

  it("null/kosong jadi string kosong", () => {
    expect(descriptionToPlainText(null)).toBe("");
  });
});

describe("plainTextToDescription", () => {
  it("round-trip dokumen desktop sederhana", () => {
    const text = descriptionToPlainText(DESKTOP_DOC);
    expect(JSON.parse(plainTextToDescription(text)!)).toEqual(JSON.parse(DESKTOP_DOC));
  });

  it("teks kosong jadi null", () => {
    expect(plainTextToDescription("  \n ")).toBeNull();
  });
});
