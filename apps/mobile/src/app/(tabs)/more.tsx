import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Link, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PageHeader } from "@/components/page-header";

type IoniconName = keyof typeof Ionicons.glyphMap;

type MenuItem = {
  title: string;
  icon: IoniconName;
  href?: Href;
};

type MenuGroup = {
  title: string;
  icon: IoniconName;
  items: MenuItem[];
};

const flatMenuItems: MenuItem[] = [
  { title: "Investasi", icon: "trending-up-outline" },
  { title: "Dana Pihak Ketiga", icon: "people-outline" },
];

const menuGroups: MenuGroup[] = [
  {
    title: "Utang Piutang",
    icon: "swap-horizontal-outline",
    items: [
      { title: "Ringkasan Kontak", icon: "person-circle-outline" },
      { title: "Piutang", icon: "arrow-down-circle-outline" },
      { title: "Utang", icon: "arrow-up-circle-outline" },
    ],
  },
  {
    title: "Master Data",
    icon: "server-outline",
    items: [
      { title: "Akun", icon: "wallet-outline" },
      { title: "Grup Akun", icon: "albums-outline" },
      { title: "Kategori", icon: "pricetags-outline", href: "/categories" as Href },
      { title: "Periode Kategori", icon: "calendar-outline", href: "/categories/periods" as Href },
      { title: "Nama Pihak", icon: "person-outline" },
    ],
  },
];

function MenuRow({ item }: { item: MenuItem }) {
  if (!item.href) {
    return (
      <View className="flex-row items-center justify-between border-b border-neutral-100 px-4 py-3.5 opacity-50">
        <View className="flex-row items-center gap-3">
          <Ionicons name={item.icon} size={18} color="#171717" />
          <Text className="text-base text-neutral-900">{item.title}</Text>
        </View>
        <Text className="text-xs text-neutral-500">Segera</Text>
      </View>
    );
  }

  return (
    <Link href={item.href} asChild>
      <Pressable className="flex-row items-center gap-3 border-b border-neutral-100 px-4 py-3.5">
        <Ionicons name={item.icon} size={18} color="#171717" />
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
        <View className="flex-row items-center gap-3">
          <Ionicons name={group.icon} size={18} color="#171717" />
          <Text className="text-base font-semibold text-neutral-900">{group.title}</Text>
        </View>
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
    <View className="flex-1 bg-white">
      <PageHeader title="Lainnya" />
      <ScrollView className="flex-1" contentContainerClassName="py-3">
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
          <MenuRow item={{ title: "Settings", icon: "settings-outline" }} />
        </View>
      </ScrollView>
    </View>
  );
}
