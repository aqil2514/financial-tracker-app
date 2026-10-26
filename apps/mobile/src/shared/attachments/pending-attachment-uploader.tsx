import { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AttachmentSourceSheet, type AttachmentSourceSheetRef } from "./attachment-source-sheet";
import { PendingAttachmentThumbnail } from "./pending-attachment-thumbnail";
import { toPendingAttachment, type PendingAttachment } from "./pending-attachment";

interface PendingAttachmentUploaderProps {
  pendingAttachments: PendingAttachment[];
  onChange: (attachments: PendingAttachment[]) => void;
  disabled?: boolean;
}

export function PendingAttachmentUploader({
  pendingAttachments,
  onChange,
  disabled,
}: PendingAttachmentUploaderProps) {
  const sheetRef = useRef<AttachmentSourceSheetRef>(null);

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-neutral-700">Lampiran</Text>
      <View className="flex-row flex-wrap gap-2">
        {pendingAttachments.map((attachment) => (
          <PendingAttachmentThumbnail
            key={attachment.id}
            attachment={attachment}
            onRemove={() => onChange(pendingAttachments.filter((a) => a.id !== attachment.id))}
          />
        ))}

        <Pressable
          className="size-20 items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-300 disabled:opacity-40"
          disabled={disabled}
          onPress={() => sheetRef.current?.present()}
        >
          <Ionicons name="add" size={20} color="#737373" />
          <Text className="text-xs text-neutral-500">Tambah</Text>
        </Pressable>
      </View>

      <AttachmentSourceSheet
        ref={sheetRef}
        onPick={(input) => onChange([...pendingAttachments, toPendingAttachment(input)])}
      />
    </View>
  );
}
