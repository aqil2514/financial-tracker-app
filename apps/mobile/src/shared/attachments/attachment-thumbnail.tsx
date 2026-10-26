import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { File } from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import type { TransactionAttachment } from "./attachment";
import { isPdfAttachment } from "./attachment";

export function AttachmentThumbnail({
  attachment,
  onRemove,
  isRemoving,
}: {
  attachment: TransactionAttachment;
  onRemove?: () => void;
  isRemoving?: boolean;
}) {
  const isPdf = isPdfAttachment(attachment.file_path);
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <>
      <View className="size-20 overflow-hidden rounded-lg border border-neutral-200">
        {isPdf ? (
          <Pressable
            className="size-full items-center justify-center gap-1"
            onPress={() => new File(attachment.file_path).preview()}
          >
            <Ionicons name="document-text-outline" size={24} color="#737373" />
            <Text className="text-[10px] text-neutral-500">PDF</Text>
          </Pressable>
        ) : (
          <Pressable className="size-full" onPress={() => setPreviewOpen(true)}>
            <Image
              source={{ uri: attachment.file_path }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          </Pressable>
        )}

        {onRemove && (
          <Pressable
            className="absolute right-1 top-1 size-5 items-center justify-center rounded-full bg-black/60 disabled:opacity-40"
            onPress={onRemove}
            disabled={isRemoving}
          >
            <Ionicons name="close" size={12} color="white" />
          </Pressable>
        )}
      </View>

      {!isPdf && (
        <Modal visible={previewOpen} transparent animationType="fade">
          <Pressable
            className="flex-1 items-center justify-center bg-black/90"
            onPress={() => setPreviewOpen(false)}
          >
            <Image
              source={{ uri: attachment.file_path }}
              style={{ width: "90%", height: "70%" }}
              contentFit="contain"
            />
          </Pressable>
        </Modal>
      )}
    </>
  );
}
