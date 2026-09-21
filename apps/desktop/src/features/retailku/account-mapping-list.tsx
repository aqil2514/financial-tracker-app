"use client";

import { useEffect, useState } from "react";

import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccounts } from "@/features/accounts";
import {
  useRetailkuAccountMapping,
  useRetailkuPaymentAccounts,
  useSaveRetailkuAccountMapping,
  type SaveRetailkuAccountMappingInput,
} from "@/shared/retailku";

type LocalAccountOption = { value: string; label: string };

/** Satu baris tabel — combobox butuh `useComboboxAnchor()` (hook),
 * jadi diekstrak ke komponen sendiri (tidak bisa dipanggil di dalam
 * `.map()` langsung). */
function AccountMappingRow({
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

/**
 * UI mapping akun Retailku (payment method) -> akun lokal
 * `financial-app`, lihat docs/todos/plan/retailku-account-mapping.md.
 * Draft di state lokal (`useState`), disinkronkan dari mapping
 * tersimpan begitu data pertama kali datang — tombol "Simpan" baru
 * menuliskannya ke `retailku_account_mapping` (UPSERT by
 * retailku_account_id, lihat use-retailku-account-mapping.ts).
 */
export function AccountMappingList() {
  const { data: retailkuAccounts, isLoading, isError, error } = useRetailkuPaymentAccounts();
  const { data: localAccounts } = useAccounts();
  const { data: savedMapping } = useRetailkuAccountMapping();
  const saveMapping = useSaveRetailkuAccountMapping();

  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);

  // Sinkron SEKALI dari data tersimpan begitu datang — bukan tiap kali
  // `savedMapping` berubah (mis. setelah save sukses invalidate query),
  // supaya draft yang sedang diedit user tidak tertimpa balik.
  useEffect(() => {
    if (hydrated || !savedMapping) return;
    if (savedMapping.length > 0) {
      setMapping(
        Object.fromEntries(
          savedMapping.map((row) => [row.retailkuAccountId, String(row.localAccountId)])
        )
      );
    }
    setHydrated(true);
  }, [hydrated, savedMapping]);

  const localAccountOptions =
    localAccounts
      ?.filter((account) => account.is_active && account.account_type === "cash")
      .map((account) => ({
        value: String(account.id),
        label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
      })) ?? [];

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

  const handleSave = () => {
    const payload: SaveRetailkuAccountMappingInput = retailkuAccounts
      .filter((account) => mapping[account.id])
      .map((account) => ({
        retailkuAccountId: account.id,
        retailkuAccountCode: account.code,
        retailkuAccountName: account.name,
        localAccountId: Number(mapping[account.id]),
      }));
    saveMapping.mutate(payload);
  };

  // Mapping tersimpan yang akun Retailku-nya sudah TIDAK lagi
  // isPaymentMethod:true (dinonaktifkan sebagai metode pembayaran di
  // sisi Retailku — lihat "Stabilitas retailku_account_id" di
  // retailku-account-mapping.md) — akun ini tidak lagi muncul di
  // `retailkuAccounts`, jadi ditampilkan terpisah supaya tidak hilang
  // diam-diam dari pandangan user.
  const currentAccountIds = new Set(retailkuAccounts.map((account) => account.id));
  const orphanMappings = (savedMapping ?? []).filter(
    (row) => !currentAccountIds.has(row.retailkuAccountId)
  );

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
              onChange={(value) =>
                setMapping((prev) => ({ ...prev, [account.id]: value ?? "" }))
              }
            />
          ))}
          {orphanMappings.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="text-muted-foreground">
                {row.retailkuAccountCode}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span>{row.retailkuAccountName}</span>
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="size-3" />
                    Tidak aktif di Retailku
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {localAccountOptions.find(
                  (option) => option.value === String(row.localAccountId)
                )?.label ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button onClick={handleSave} disabled={saveMapping.isPending}>
        {saveMapping.isPending ? "Menyimpan..." : "Simpan Mapping"}
      </Button>
    </div>
  );
}
