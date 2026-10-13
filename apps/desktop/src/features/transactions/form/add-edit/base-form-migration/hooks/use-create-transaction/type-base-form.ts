import type { PendingAttachment } from "@/shared/attachments/pending-attachment";

export type UseCreateTransactionBaseFormOptions = {
  getPendingAttachments?: () => PendingAttachment[];
  attachmentFolder?: string | null;
  onAttachmentsSaved?: () => void;
  onClosed?: () => void;
};
