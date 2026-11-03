import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Link, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PageHeader } from "@/components/page-header";
import { useCloudSync } from "@/shared/cloud-sync";

type IoniconName = keyof typeof Ionicons.glyphMap;

type MenuItem = {
  title: string;
  icon: IoniconName;
  href?: Href;
  badge?: { text: string; tone: "neutral" | "error" };
};

type MenuGroup = {
  title: string;
  icon: IoniconName;
  items: MenuItem[];
};

const flatMenuItems: MenuItem[] = [
  { title: "Investasi", icon: "trending-up-outline", href: "/investments" as Href },
  { title: "Dana Pihak Ketiga", icon: "people-outline", href: "/third-party" as Href },
];

const menuGroups: MenuGroup[] = [
  {
    title: "Utang Piutang",
    icon: "swap-horizontal-outline",
    items: [
      { title: "Ringkasan Kontak", icon: "person-circle-outline", href: "/debts" as Href },
      { title: "Utang Piutang", icon: "arrow-down-circle-outline", href: "/debts/list" as Href },
    ],
  },
  {
    title: "Master Data",
    icon: "server-outline",
    items: [
      { title: "Akun", icon: "wallet-outline", href: "/accounts" as Href },
      { title: "Kategori", icon: "pricetags-outline", href: "/categories" as Href },
      { title: "Periode Kategori", icon: "calendar-outline", href: "/categories/periods" as Href },
      { title: "Nama Pihak", icon: "person-outline", href: "/contacts" as Href },
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
        {item.badge && (
          <Text className={`ml-auto text-xs ${item.badge.tone === "error" ? "text-red-600" : "text-neutral-500"}`}>
            {item.badge.text}
          </Text>
        )}
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

function useSyncBadge(): MenuItem["badge"] {
  const { snapshot } = useCloudSync();
  if (snapshot.status === "off") return undefined;
  if (snapshot.status === "error") return { text: "Gagal sync", tone: "error" };
  if (snapshot.status === "syncing") return { text: "Menyinkronkan...", tone: "neutral" };
  if (snapshot.pending > 0) return { text: `${snapshot.pending} menunggu`, tone: "neutral" };
  return { text: "Tersinkron", tone: "neutral" };
}

export default function MorePage() {
  const syncBadge = useSyncBadge();

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
          <MenuRow item={{ title: "Settings", icon: "settings-outline", href: "/settings" as Href, badge: syncBadge }} />
        </View>
      </ScrollView>
    </View>
  );
}
