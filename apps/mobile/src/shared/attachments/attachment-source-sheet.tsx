import { forwardRef, useImperativeHandle, useRef } from "react";
import { Pressable, Text } from "react-native";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import type { AddAttachmentInput } from "./use-add-attachment";

export interface AttachmentSourceSheetRef {
  present: () => void;
}

interface AttachmentSourceSheetProps {
  onPick: (input: AddAttachmentInput) => void;
}

const SOURCES = [
  { key: "library", label: "Galeri", icon: "images-outline" as const },
  { key: "camera", label: "Kamera", icon: "camera-outline" as const },
  { key: "document", label: "Dokumen", icon: "document-outline" as const },
];

async function pickFromLibrary(): Promise<AddAttachmentInput | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
  if (result.canceled) return null;

  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.fileName ?? "image.jpg" };
}

async function pickFromCamera(): Promise<AddAttachmentInput | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  if (result.canceled) return null;

  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.fileName ?? "photo.jpg" };
}

async function pickFromDocuments(): Promise<AddAttachmentInput | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"] });
  if (result.canceled) return null;

  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.name };
}

export const AttachmentSourceSheet = forwardRef<AttachmentSourceSheetRef, AttachmentSourceSheetProps>(
  function AttachmentSourceSheet({ onPick }, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);

    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
    }));

    async function handleSelect(key: (typeof SOURCES)[number]["key"]) {
      sheetRef.current?.dismiss();

      const input =
        key === "library"
          ? await pickFromLibrary()
          : key === "camera"
            ? await pickFromCamera()
            : await pickFromDocuments();

      if (input) onPick(input);
    }

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["35%"]}
        enableDynamicSizing={false}
        stackBehavior="push"
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}
      >
        <BottomSheetView className="flex-1 gap-3 px-4 pb-4">
          <Text className="text-lg font-semibold text-neutral-900">Tambah Lampiran</Text>

          {SOURCES.map((source) => (
            <Pressable
              key={source.key}
              className="flex-row items-center gap-3 rounded-md border border-neutral-200 px-4 py-3"
              onPress={() => handleSelect(source.key)}
            >
              <Ionicons name={source.icon} size={20} color="#171717" />
              <Text className="text-neutral-900">{source.label}</Text>
            </Pressable>
          ))}
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);
