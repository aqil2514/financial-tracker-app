"use client";

import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ListItemMenuAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
}

/**
 * Menu aksi generik untuk item list berbentuk card (akun, grup akun,
 * kategori, transaksi, dll) — pengganti pola lama "dua tombol icon
 * bersebelahan" (edit + hapus) supaya jumlah aksi bisa bertambah tanpa
 * card jadi penuh tombol. Pola diadaptasi dari `createActionColumn` di
 * proyek retail-multitenant (versi table/ColumnDef), disederhanakan
 * untuk konteks card di sini.
 *
 * Item dialog (Edit, Lihat Detail, dll) TIDAK bisa dipicu langsung dari
 * `DropdownMenuItem` sebagai trigger — menu dan dialog sama-sama
 * portal/focus-trap yang saling menutup satu sama lain. Pola yang benar:
 * dialog dikontrol via state `open` terpisah di komponen pemanggil,
 * `onClick` di sini hanya men-set state itu jadi `true` setelah menu
 * tertutup.
 */
export function ListItemActionsMenu({ actions }: { actions: ListItemMenuAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            variant={action.variant}
            disabled={action.disabled}
            onClick={action.onClick}
          >
            <action.icon />
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
