import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Link, type Href } from "expo-router";

type MenuItem = {
  title: string;
  href?: Href;
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

// Href belum ada untuk route yang belum dibuat di mobile (lihat
// app-sidebar.tsx desktop untuk daftar lengkap) — item tanpa href
// ditampilkan non-aktif sampai halamannya ada.
const flatMenuItems: MenuItem[] = [
  { title: "Investasi" },
  { title: "Dana Pihak Ketiga" },
];

const menuGroups: MenuGroup[] = [
  {
    title: "Utang Piutang",
    items: [
      { title: "Ringkasan Kontak" },
      { title: "Piutang" },
      { title: "Utang" },
    ],
  },
  {
    title: "Master Data",
    items: [
      { title: "Akun" },
      { title: "Grup Akun" },
      { title: "Kategori" },
      { title: "Nama Pihak" },
    ],
  },
];

function MenuRow({ item }: { item: MenuItem }) {
  if (!item.href) {
    return (
      <View className="flex-row items-center justify-between border-b border-neutral-100 px-4 py-3.5 opacity-50">
        <Text className="text-base text-neutral-900">{item.title}</Text>
        <Text className="text-xs text-neutral-500">Segera</Text>
      </View>
    );
  }

  return (
    <Link href={item.href} asChild>
      <Pressable className="flex-row items-center justify-between border-b border-neutral-100 px-4 py-3.5">
        <Text className="text-base text-neutral-900">{item.title}</Text>
      </Pressable>
    </Link>
  );
}

function MenuGroupSection({ group }: { group: MenuGroup }) {
  const [open, setOpen] = useState(false);

  return (
    <View className="border-b border-neutral-100">
      <Pressable
        className="flex-row items-center justify-between px-4 py-3.5"
        onPress={() => setOpen((prev) => !prev)}
      >
        <Text className="text-base font-semibold text-neutral-900">{group.title}</Text>
        <Text className="text-lg text-neutral-500">{open ? "⌄" : "›"}</Text>
      </Pressable>
      {open && (
        <View className="bg-neutral-50 pl-4">
          {group.items.map((item) => (
            <MenuRow key={item.title} item={item} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function MorePage() {
  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="py-3">
      <View className="mb-4 border-y border-neutral-200">
        {flatMenuItems.map((item) => (
          <MenuRow key={item.title} item={item} />
        ))}
      </View>

      <View className="mb-4 border-y border-neutral-200">
        {menuGroups.map((group) => (
          <MenuGroupSection key={group.title} group={group} />
        ))}
      </View>

      <View className="mb-4 border-y border-neutral-200">
        <MenuRow item={{ title: "Settings" }} />
      </View>
    </ScrollView>
  );
}
