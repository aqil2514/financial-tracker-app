import { useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AttachmentSourceSheet, type AttachmentSourceSheetRef } from "./attachment-source-sheet";
import { AttachmentThumbnail } from "./attachment-thumbnail";
import { useAddAttachment } from "./use-add-attachment";
import { useDeleteAttachment } from "./use-delete-attachment";
import { useTransactionAttachments } from "./use-transaction-attachments";

export function AttachmentUploader({ transactionId }: { transactionId: string }) {
  const { attachments, refetch } = useTransactionAttachments(transactionId);
  const { addAttachment, isPending: isAdding } = useAddAttachment(transactionId, refetch);
  const { deleteAttachment, isPending: isDeleting } = useDeleteAttachment(transactionId, refetch);
  const sheetRef = useRef<AttachmentSourceSheetRef>(null);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-neutral-700">Lampiran</Text>
      <View className="flex-row flex-wrap gap-2">
        {attachments.map((attachment) => (
          <AttachmentThumbnail
            key={attachment.id}
            attachment={attachment}
            onRemove={() => deleteAttachment(attachment)}
            isRemoving={isDeleting}
          />
        ))}

        <Pressable
          className="size-20 items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-300 disabled:opacity-40"
          disabled={isAdding}
          onPress={() => sheetRef.current?.present()}
        >
          <Ionicons name="add" size={20} color="#737373" />
          <Text className="text-xs text-neutral-500">Tambah</Text>
        </Pressable>
      </View>

      <AttachmentSourceSheet ref={sheetRef} onPick={addAttachment} />
    </View>
  );
}
