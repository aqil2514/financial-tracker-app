"use client";

import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccounts } from "@/features/accounts";
import { useRetailkuPaymentAccounts } from "@/shared/retailku";

/**
 * UI mapping akun Retailku (payment method) -> akun lokal
 * `financial-app` — lihat "Kebutuhan skema baru untuk integrasi ini" di
 * debt-receivable-tracking.md. TAHAP INI: cuma tampilan + pilihan di
 * state React lokal, BELUM disimpan ke database — dibahas lebih lanjut
 * sebelum didesain skema penyimpanannya (tabel
 * `retailku_account_mapping` yang disebut di dokumen).
 */
export function AccountMappingList() {
  const { data: retailkuAccounts, isLoading, isError, error } = useRetailkuPaymentAccounts();
  const { data: localAccounts } = useAccounts();
  const [mapping, setMapping] = useState<Record<string, string>>({});

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

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Tentukan transaksi ringkasan dari akun Retailku mana masuk ke
        akun kas/bank lokal yang mana. Pilihan di bawah BELUM tersimpan —
        halaman ini baru menampilkan opsinya.
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
            <TableRow key={account.id}>
              <TableCell className="text-muted-foreground">{account.code}</TableCell>
              <TableCell>{account.name}</TableCell>
              <TableCell>
                <Select
                  value={mapping[account.id] ?? ""}
                  onValueChange={(value: string | null) =>
                    setMapping((prev) => ({ ...prev, [account.id]: value ?? "" }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih akun lokal...">
                      {(value: string) =>
                        localAccountOptions.find((option) => option.value === value)?.label ??
                        "Pilih akun lokal..."
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {localAccountOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
