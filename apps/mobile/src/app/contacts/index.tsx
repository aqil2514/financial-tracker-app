import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ContactList } from "@/features/contacts/content/contact-list";
import { useContacts } from "@/features/contacts/content/use-contacts";

export default function ContactsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { contacts, isLoading } = useContacts();
  const [search, setSearch] = useState("");

  const filteredContacts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return contacts;
    return contacts.filter((contact) => contact.name.toLowerCase().includes(keyword));
  }, [contacts, search]);

  return (
    <>
      <Stack.Screen options={{ title: "Nama Pihak" }} />
      <View className="flex-1 bg-white">
        <View className="border-b border-neutral-100 px-4 py-3">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Cari nama kontak..."
            className="rounded-md border border-neutral-300 px-3 py-2 text-neutral-900"
          />
        </View>

        <ContactList
          contacts={filteredContacts}
          isLoading={isLoading}
          hasAnyContact={contacts.length > 0}
          onPress={(id) => router.push({ pathname: "/contacts/[id]/edit", params: { id } })}
        />

        <Pressable
          className="absolute right-5 size-14 items-center justify-center rounded-full bg-neutral-900 shadow-lg"
          style={{ bottom: insets.bottom + 20 }}
          onPress={() => router.push("/contacts/new")}
        >
          <Text className="text-2xl text-white">+</Text>
        </Pressable>
      </View>
    </>
  );
}
