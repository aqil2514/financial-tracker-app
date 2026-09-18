"use client";

import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";

import { cn } from "cn";

/** Render read-only dari dokumen Tiptap JSON — dipakai di tempat yang
 * hanya menampilkan (bukan mengedit) `description` transaksi. */
export function RichTextViewer({
  value,
  className,
}: {
  value: JSONContent;
  className?: string;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn("prose prose-sm dark:prose-invert max-w-none outline-none", className),
      },
    },
  });

  if (!editor) return null;

  return <EditorContent editor={editor} />;
}
