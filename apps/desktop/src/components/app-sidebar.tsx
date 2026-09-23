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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useRetailkuAutoSync } from "@/features/retailku";
import {
  useRetailkuMappingIssues,
  useRetailkuPaymentAccounts,
  useRetailkuSettings,
} from "@/shared/retailku";

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
 * retailku-integration.md. Halaman /retailku/mapping terpisah (menu
 * "Mapping Akun") sudah DIHAPUS — pengaturan mapping sekarang di tab
 * "Mapping" pada halaman "Sync Cashflow" itu sendiri, lihat
 * docs/todos/plan/retailku-sync-field-mapping.md. */
const retailkuNavGroup: CollapsibleNavGroup = {
  title: "Retailku",
  icon: Building2,
  items: [{ title: "Sync Cashflow", url: "/retailku/cashflow" }],
};

export function AppSidebar() {
  const pathname = usePathname();
  const { data: retailkuSettings } = useRetailkuSettings();
  const isRetailkuConnected = !!retailkuSettings?.mcpUrl && !!retailkuSettings?.apiKey;

  // Best-effort, non-blocking: query ini `enabled` cuma kalau kredensial
  // lengkap, dan react-query otomatis tidak melakukan apa pun saat
  // offline/gagal (tidak menunda render apa pun di sini). Tujuannya
  // supaya data akun Retailku (dipakai untuk deteksi mapping "orphan" —
  // lihat "Stabilitas retailku_account_id" di
  // retailku-account-mapping.md) sudah fresh di cache begitu user buka
  // halaman mapping, bukan menunggu fetch baru saat itu juga.
  useRetailkuPaymentAccounts();

  // Titik 1 (best-effort, deteksi dini) di "Stabilitas
  // retailku_account_id" — retailku-account-mapping.md: kalau ada
  // mapping tersimpan yang akunnya sudah dinonaktifkan sebagai payment
  // method di Retailku (isPaymentMethod:false), tampilkan badge jumlah
  // di menu "Retailku" supaya user tahu LEBIH DINI, bukan nunggu
  // ketahuan pas sync jalan (titik 2, point-of-use — sudah ada di
  // computeCashflowSync). Diam-diam (0 badge) kalau offline/belum ada
  // masalah — TIDAK menunda render apa pun.
  const { deactivatedMappings } = useRetailkuMappingIssues();

  // Titik masuk trigger sync OTOMATIS saat app dibuka — "Pertanyaan
  // terbuka #2" di retailku-cashflow-sync.md. Best-effort seperti
  // prefetch/badge di atas: mengecek 3 pagar (toggle
  // autoSyncEnabled/maks 1x sehari/semua field konfigurasi lengkap)
  // sebelum benar-benar memicu `syncAll()`, diam-diam skip kalau salah
  // satu pagar belum terpenuhi (BUKAN toast error) — kegagalan sync
  // yang SEMPAT dicoba tetap dilaporkan non-blocking (toast warning),
  // tidak pernah menunda render sidebar.
  useRetailkuAutoSync();

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
                        {group.title === "Retailku" && deactivatedMappings.length > 0 && (
                          <SidebarMenuBadge className="static ml-auto mr-1 bg-destructive/10 text-destructive">
                            {deactivatedMappings.length}
                          </SidebarMenuBadge>
                        )}
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
