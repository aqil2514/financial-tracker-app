import { FlatList, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ContactListItem } from "../types";

interface ContactListProps {
  contacts: ContactListItem[];
  isLoading: boolean;
  hasAnyContact: boolean;
  onPress: (id: string) => void;
}

export function ContactList({ contacts, isLoading, hasAnyContact, onPress }: ContactListProps) {
  if (!isLoading && contacts.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-neutral-500">
          {hasAnyContact ? "Tidak ada kontak yang cocok dengan pencarian." : "Belum ada kontak."}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={contacts}
      keyExtractor={(item) => item.id}
      contentContainerClassName="pb-20"
      renderItem={({ item }) => (
        <Pressable
          className="flex-row items-center gap-3 border-b border-neutral-100 px-4 py-3.5"
          onPress={() => onPress(item.id)}
        >
          <Ionicons name="person-circle-outline" size={28} color="#737373" />
          <View className="flex-1">
            <Text className="text-base text-neutral-900">{item.name}</Text>
            {item.note && (
              <Text className="text-sm text-neutral-500" numberOfLines={1}>
                {item.note}
              </Text>
            )}
          </View>
        </Pressable>
      )}
    />
  );
}
