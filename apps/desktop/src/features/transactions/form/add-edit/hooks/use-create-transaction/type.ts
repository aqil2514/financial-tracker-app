import type { PendingAttachment } from "@/shared/attachments/pending-attachment";

export type UseCreateTransactionOptions = {
  open: boolean;
  getPendingAttachments?: () => PendingAttachment[];
  attachmentFolder?: string | null;
  onAttachmentsSaved?: () => void;
  onClosed?: () => void;
  defaultAccountId?: string;
};
