"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { AccountWithBalance } from "@/hooks/resources/use-accounts";
import type { Category } from "@/lib/db";
import { formatMappingKeyLabel } from "./format-mapping-key";
import type { MappingRowDraft } from "./hooks/use-mapping-draft";

const NO_CATEGORY_VALUE = "__none__";

/** Satu baris form mapping — akun (dropdown, WAJIB), note/category/
 * description (semua OPSIONAL, kosong = fallback default saat sync,
 * lihat "Field fallback default" di
 * docs/todos/plan/retailku-sync-field-mapping.md). */
export function FieldMappingRow({
  row,
  localAccountOptions,
  categoryOptions,
  onChange,
}: {
  row: MappingRowDraft;
  localAccountOptions: AccountWithBalance[];
  categoryOptions: Category[];
  onChange: (patch: Partial<MappingRowDraft>) => void;
}) {
  return (
    <TableRow>
      <TableCell className="align-top">
        <p className="font-medium">{row.accountName}</p>
        <p className="text-muted-foreground text-xs">{row.retailkuAccountCode}</p>
      </TableCell>
      <TableCell className="align-top">
        <p className="text-sm">{formatMappingKeyLabel(row.key)}</p>
      </TableCell>
      <TableCell className="align-top">
        <Select
          value={row.localAccountId?.toString() ?? ""}
          onValueChange={(value) => onChange({ localAccountId: value ? Number(value) : null })}
        >
          <SelectTrigger className="w-full min-w-40">
            <SelectValue placeholder="Pilih akun..." />
          </SelectTrigger>
          <SelectContent>
            {localAccountOptions.map((account) => (
              <SelectItem key={account.id} value={String(account.id)}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="align-top">
        <Input
          value={row.note}
          placeholder="Judul default"
          onChange={(e) => onChange({ note: e.target.value })}
        />
      </TableCell>
      <TableCell className="align-top">
        <Select
          value={row.categoryId?.toString() ?? NO_CATEGORY_VALUE}
          onValueChange={(value) =>
            onChange({ categoryId: value === NO_CATEGORY_VALUE ? null : Number(value) })
          }
        >
          <SelectTrigger className="w-full min-w-40">
            <SelectValue placeholder="Tanpa kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CATEGORY_VALUE}>Tanpa kategori</SelectItem>
            {categoryOptions.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="align-top">
        <Textarea
          value={row.description}
          placeholder="Opsional"
          className="min-h-9"
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </TableCell>
    </TableRow>
  );
}
