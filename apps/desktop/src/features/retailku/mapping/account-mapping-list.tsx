"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AccountMappingRow, OrphanAccountMappingRow } from "./account-mapping-row";
import { useAccountMappingDraft } from "./use-account-mapping-draft";

/**
 * UI mapping akun Retailku (payment method) -> akun lokal
 * `financial-app`, lihat docs/todos/plan/retailku-account-mapping.md.
 * Logic draft/hidrasi/save ada di `useAccountMappingDraft` — komponen
 * ini murni render.
 */
export function AccountMappingList() {
  const {
    retailkuAccounts,
    isLoading,
    isError,
    error,
    mapping,
    setAccountMapping,
    localAccountOptions,
    orphanMappings,
    handleSave,
    isSaving,
  } = useAccountMappingDraft();

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Memuat akun dari Retailku...</p>;
  }

  if (isError) {
    return (
      <p className="text-destructive text-sm">
        Gagal memuat akun Retailku: {error instanceof Error ? error.message : String(error)}
      </p>
    );
  }

  if (!retailkuAccounts || retailkuAccounts.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Tidak ada akun payment method ditemukan di Retailku.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Tentukan transaksi ringkasan dari akun Retailku mana masuk ke
        akun kas/bank lokal yang mana.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kode</TableHead>
            <TableHead>Akun Retailku</TableHead>
            <TableHead>Akun Lokal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {retailkuAccounts.map((account) => (
            <AccountMappingRow
              key={account.id}
              code={account.code}
              name={account.name}
              value={mapping[account.id] ?? ""}
              options={localAccountOptions}
              onChange={(value) => setAccountMapping(account.id, value)}
            />
          ))}
          {orphanMappings.map((row) => (
            <OrphanAccountMappingRow
              key={row.id}
              code={row.retailkuAccountCode}
              name={row.retailkuAccountName}
              localAccountLabel={
                localAccountOptions.find((option) => option.value === String(row.localAccountId))
                  ?.label ?? "—"
              }
            />
          ))}
        </TableBody>
      </Table>
      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? "Menyimpan..." : "Simpan Mapping"}
      </Button>
    </div>
  );
}
