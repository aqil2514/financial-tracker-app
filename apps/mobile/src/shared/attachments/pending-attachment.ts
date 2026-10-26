import { generateId } from "@/lib/database";
import type { AddAttachmentInput } from "./use-add-attachment";
import { isPdfAttachment } from "./attachment";

export interface PendingAttachment {
  id: string;
  isPdf: boolean;
  input: AddAttachmentInput;
}

export function toPendingAttachment(input: AddAttachmentInput): PendingAttachment {
  return { id: generateId(), isPdf: isPdfAttachment(input.name), input };
}
