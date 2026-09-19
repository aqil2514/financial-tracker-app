"use client";

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

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Transaksi", url: "/transactions", icon: ArrowLeftRight },
  { title: "Laporan", url: "/reports", icon: PieChart },
];

const collapsibleNavItems: {
  title: string;
  icon: LucideIcon;
  items: { title: string; url: string }[];
}[] = [
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

export function AppSidebar() {
  const pathname = usePathname();

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
                    defaultOpen={isGroupActive}
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
