// Kolom `description` disimpan sebagai TipTap JSON (format desktop). Mobile
// tidak punya editor rich text, jadi diedit sebagai teks biasa: baris
// berawalan "- " ↔ bulletList, baris lain ↔ paragraph.

interface DocNode {
  type?: string;
  text?: string;
  content?: DocNode[];
}

function inlineText(node: DocNode): string {
  if (node.type === "hardBreak") return "\n";
  if (node.text) return node.text;
  return (node.content ?? []).map(inlineText).join("");
}

function blockLines(node: DocNode): string[] {
  if (node.type === "bulletList" || node.type === "orderedList") {
    return (node.content ?? []).map((item, i) => {
      const marker = node.type === "orderedList" ? `${i + 1}. ` : "- ";
      return marker + (item.content ?? []).map(inlineText).join(" ");
    });
  }
  return [inlineText(node)];
}

export function descriptionToPlainText(value: string | null | undefined): string {
  if (!value) return "";
  let doc: DocNode;
  try {
    doc = JSON.parse(value);
  } catch {
    return value;
  }
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.content)) return value;
  return doc.content.flatMap(blockLines).join("\n");
}

export function plainTextToDescription(text: string): string | null {
  if (!text.trim()) return null;
  const content: object[] = [];
  let bullets: object[] | null = null;

  for (const line of text.split("\n")) {
    const bullet = /^\s*[-•*]\s+(.*)$/.exec(line);
    if (bullet) {
      const item = {
        type: "listItem",
        content: [{ type: "paragraph", content: textContent(bullet[1]) }],
      };
      if (bullets) bullets.push(item);
      else {
        bullets = [item];
        content.push({ type: "bulletList", content: bullets });
      }
    } else {
      bullets = null;
      content.push({ type: "paragraph", content: textContent(line) });
    }
  }
  return JSON.stringify({ type: "doc", content });
}

function textContent(text: string) {
  return text ? [{ type: "text", text }] : undefined;
}
