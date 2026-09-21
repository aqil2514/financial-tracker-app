"use client";

import { Badge } from "@/components/ui/badge";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { TableCell, TableRow } from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";

export type LocalAccountOption = { value: string; label: string };

/** Satu baris tabel — combobox butuh `useComboboxAnchor()` (hook),
 * jadi diekstrak ke komponen sendiri (tidak bisa dipanggil di dalam
 * `.map()` langsung). */
export function AccountMappingRow({
  code,
  name,
  value,
  options,
  onChange,
}: {
  code: string;
  name: string;
  value: string;
  options: LocalAccountOption[];
  onChange: (value: string | null) => void;
}) {
  const anchor = useComboboxAnchor();
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{code}</TableCell>
      <TableCell>{name}</TableCell>
      <TableCell>
        <div ref={anchor}>
          <Combobox
            items={options}
            value={selected}
            onValueChange={(item: LocalAccountOption | null) => onChange(item?.value ?? null)}
          >
            <ComboboxInput placeholder="Pilih akun lokal..." showClear />
            <ComboboxContent anchor={anchor}>
              <ComboboxEmpty>Tidak ditemukan</ComboboxEmpty>
              <ComboboxList>
                {(item: LocalAccountOption) => (
                  <ComboboxItem key={item.value} value={item}>
                    {item.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      </TableCell>
    </TableRow>
  );
}

/** Baris untuk mapping tersimpan yang akun Retailku-nya sudah TIDAK
 * lagi `isPaymentMethod:true` (lihat "Stabilitas retailku_account_id"
 * di retailku-account-mapping.md) — read-only, tidak bisa diedit lagi
 * lewat combobox karena opsi sumbernya (`retailkuAccounts`) sudah
 * tidak menyertakannya. */
export function OrphanAccountMappingRow({
  code,
  name,
  localAccountLabel,
}: {
  code: string;
  name: string;
  localAccountLabel: string;
}) {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{code}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span>{name}</span>
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="size-3" />
            Tidak aktif di Retailku
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">{localAccountLabel}</TableCell>
    </TableRow>
  );
}
