"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  Settings,
  Wallet,
  HandCoins,
  Database,
  Building2,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useRetailkuSettings } from "@/shared/retailku";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Transaksi", url: "/transactions", icon: ArrowLeftRight },
  { title: "Laporan", url: "/reports", icon: PieChart },
];

type CollapsibleNavGroup = {
  title: string;
  icon: LucideIcon;
  items: { title: string; url: string }[];
};

const staticCollapsibleNavItems: CollapsibleNavGroup[] = [
  {
    title: "Utang Piutang",
    icon: HandCoins,
    items: [
      { title: "Ringkasan Kontak", url: "/debts" },
      { title: "Piutang", url: "/debts/receivables" },
      { title: "Utang", url: "/debts/payables" },
    ],
  },
  {
    title: "Master Data",
    icon: Database,
    items: [
      { title: "Akun", url: "/master-data/accounts" },
      { title: "Grup Akun", url: "/master-data/account-groups" },
      { title: "Kategori", url: "/master-data/categories" },
      { title: "Nama Pihak", url: "/master-data/contacts" },
    ],
  },
];

/** Grup "Retailku" cuma disisipkan begitu kredensial (URL MCP + API
 * Key) sudah tersimpan — menu setup mapping akun tidak ada gunanya
 * sebelum terkoneksi, lihat "Status implementasi" di
 * retailku-integration.md. */
const retailkuNavGroup: CollapsibleNavGroup = {
  title: "Retailku",
  icon: Building2,
  items: [{ title: "Mapping Akun", url: "/retailku/mapping" }],
};

export function AppSidebar() {
  const pathname = usePathname();
  const { data: retailkuSettings } = useRetailkuSettings();
  const isRetailkuConnected = !!retailkuSettings?.mcpUrl && !!retailkuSettings?.apiKey;

  const collapsibleNavItems: CollapsibleNavGroup[] = isRetailkuConnected
    ? [...staticCollapsibleNavItems, retailkuNavGroup]
    : staticCollapsibleNavItems;

  // Fully controlled (bukan defaultOpen) — pathname bisa berubah antar
  // navigasi tanpa Collapsible ini di-remount (key-nya stabil per grup),
  // dan base-ui menganggap perubahan defaultOpen setelah mount sebagai
  // pola tidak valid untuk komponen uncontrolled. State dimulai `false`
  // lalu disinkronkan ke grup yang aktif via `pathname` di effect,
  // supaya user tetap bisa toggle manual (tidak otomatis menutup lagi)
  // begitu grup itu sudah pernah dibuka via navigasi.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const activeGroup = collapsibleNavItems.find((group) =>
      group.items.some((item) => item.url === pathname)
    );
    if (activeGroup) {
      setOpenGroups((prev) => ({ ...prev, [activeGroup.title]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isRetailkuConnected]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Wallet className="size-4" />
              </div>
              <span className="font-semibold">Financial App</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    render={<Link href={item.url} />}
                    isActive={pathname === item.url}
                    tooltip={item.title}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {collapsibleNavItems.map((group) => {
                const isGroupActive = group.items.some((item) => item.url === pathname);
                return (
                  <Collapsible
                    key={group.title}
                    open={openGroups[group.title] ?? false}
                    onOpenChange={(open) =>
                      setOpenGroups((prev) => ({ ...prev, [group.title]: open }))
                    }
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger
                        render={
                          <SidebarMenuButton isActive={isGroupActive} tooltip={group.title} />
                        }
                      >
                        <group.icon />
                        <span>{group.title}</span>
                        <ChevronRight className="ml-auto transition-transform group-data-panel-open/collapsible:rotate-90" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {group.items.map((item) => (
                            <SidebarMenuSubItem key={item.url}>
                              <SidebarMenuSubButton
                                render={<Link href={item.url} />}
                                isActive={pathname === item.url}
                              >
                                <span>{item.title}</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}

              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/settings" />}
                  isActive={pathname === "/settings"}
                  tooltip="Settings"
                >
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
