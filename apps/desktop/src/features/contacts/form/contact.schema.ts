import { z } from "zod";
import type { JSONContent } from "@tiptap/react";

export const contactSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  note: z.custom<JSONContent>().nullable(),
});

export type ContactFormValues = z.input<typeof contactSchema>;
export type ContactFormOutput = z.output<typeof contactSchema>;
