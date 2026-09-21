"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAccounts } from "@/hooks/resources/use-accounts";
import {
  assertRetailkuConfigured,
  useRetailkuAccountMapping,
  useRetailkuCashflowSyncSettings,
  useRetailkuSettings,
  useSetRetailkuCashflowSyncSettings,
  useSyncRetailkuAll,
  type RetailkuCashflowSyncMode,
} from "@/shared/retailku";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Tab "Konfigurasi" — kontrol sync (toggle mode, field akun, titik
 * awal sync, toggle auto-sync, tombol "Sync Sekarang"), lihat
 * docs/todos/plan/retailku-cashflow-sync.md keputusan #1/#2 (REVISI)/#3.
 * Trigger otomatis saat app dibuka BELUM diwire di sini — itu titik
 * masuk terpisah (mis. AppSidebar), tab ini baru menyediakan
 * pengaturannya.
 *
 * SEMUA field di sini (mode, 3 field akun, titik awal, toggle
 * auto-sync) disimpan ke `settings` lewat `useRetailkuCashflowSyncSettings`
 * — BUKAN `useState` lokal murni. Ditemukan bug live: mode & 3 field
 * akun SEMPAT cuma `useState`, hilang begitu pindah tab/tutup app
 * ("sudah berhasil disimpan, tapi kembali ke halaman ini tidak ada yang
 * benar-benar tersimpan") — diperbaiki dengan menyambungkan semuanya ke
 * `settings`, pola sama seperti `syncFrom`/`autoSyncEnabled` yang dari
 * awal sudah benar.
 *
 * CATATAN keputusan #2 revisi: TIDAK ADA LAGI validasi "semua mapping
 * harus ke akun lokal yang sama" — cashflow sekarang sync per akun kas
 * Retailku sendiri-sendiri (lihat sync-cashflow.ts), jadi mapping akun
 * cuma perlu ADA (bukan seragam) supaya tidak ada baris di-skip sebagai
 * "belum dipetakan". */
export function CashflowConfigTab() {
  const { data: mappings, isLoading: mappingsLoading } = useRetailkuAccountMapping();
  const { data: accounts } = useAccounts();
  const { data: retailkuSettings } = useRetailkuSettings();
  const { data: syncSettings, isLoading: syncSettingsLoading } = useRetailkuCashflowSyncSettings();
  const setSyncSettings = useSetRetailkuCashflowSyncSettings();
  const syncAll = useSyncRetailkuAll();

  const [syncFromDraft, setSyncFromDraft] = useState<string | null>(null);

  const hasMappings = (mappings?.length ?? 0) > 0;
  const cashAccountOptions =
    accounts?.filter((account) => account.account_type === "cash" && account.is_active) ?? [];
  const debtAccountOptions =
    accounts?.filter((account) => account.account_type === "debt" && account.is_active) ?? [];

  const mode = syncSettings?.syncMode ?? "summary";
  const arApCashAccountId = syncSettings?.arApCashAccountId?.toString() ?? "";
  const receivableDebtAccountId = syncSettings?.receivableDebtAccountId?.toString() ?? "";
  const payableDebtAccountId = syncSettings?.payableDebtAccountId?.toString() ?? "";
  const syncFromValue = syncFromDraft ?? syncSettings?.syncFrom ?? "";

  const canSync =
    hasMappings &&
    !!retailkuSettings?.mcpUrl &&
    !!retailkuSettings?.apiKey &&
    arApCashAccountId !== "" &&
    receivableDebtAccountId !== "" &&
    payableDebtAccountId !== "" &&
    syncFromValue !== "";

  function handleSaveSyncFrom() {
    if (syncFromDraft == null) return;
    setSyncSettings.mutate({ syncFrom: syncFromDraft }, { onSuccess: () => setSyncFromDraft(null) });
  }

  function handleSyncNow() {
    if (!canSync) return;
    const config = assertRetailkuConfigured(retailkuSettings!);

    syncAll.mutate(
      {
        mcpConfig: config,
        arApCashAccountId: Number(arApCashAccountId),
        receivableDebtAccountId: Number(receivableDebtAccountId),
        payableDebtAccountId: Number(payableDebtAccountId),
        dateFrom: syncFromValue,
        dateTo: todayIso(),
        timezone: "Asia/Jakarta",
        mode,
      },
      {
        onSuccess: (result) => {
          setSyncSettings.mutate({ syncFrom: todayIso() });
          if (result.cashflowUnmappedAccountIds.length > 0) {
            toast.warning(
              `${result.cashflowUnmappedAccountIds.length} akun kas Retailku belum dipetakan — baris kasnya di-skip. Lengkapi di Mapping Akun.`
            );
          }
        },
      }
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Mapping Akun</h3>
        {mappingsLoading ? (
          <p className="text-muted-foreground text-sm">Memeriksa mapping akun...</p>
        ) : hasMappings ? (
          <p className="text-muted-foreground text-sm">
            {mappings!.length} akun Retailku sudah dipetakan. Setiap akun kas Retailku disync ke akun
            lokalnya masing-masing.
          </p>
        ) : (
          <p className="text-destructive text-sm">Belum ada mapping akun Retailku. Lengkapi dulu di Mapping Akun.</p>
        )}
        {!hasMappings && !mappingsLoading && (
          <Button variant="outline" size="sm" render={<Link href="/retailku/mapping" />}>
            Buka Mapping Akun
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Mode Sync Cashflow</h3>
        <p className="text-muted-foreground text-sm">
          Mode ringkas mencatat 1 transaksi per akun kas Retailku per hari. Mode detail mencatat 1
          transaksi per akun per kategori (sourceType) per hari, lebih granular tapi lebih berat. Ganti
          mode tidak mengubah transaksi yang sudah tersinkron dengan mode sebelumnya.
        </p>
        <ToggleGroup
          value={[mode]}
          onValueChange={(values: string[]) => {
            if (values.length > 0) {
              setSyncSettings.mutate({ syncMode: values[values.length - 1] as RetailkuCashflowSyncMode });
            }
          }}
        >
          <ToggleGroupItem value="summary">Mode ringkas</ToggleGroupItem>
          <ToggleGroupItem value="detail">Mode detail per kategori</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Akun Kas untuk Utang Piutang</h3>
        <p className="text-muted-foreground text-sm">
          Sisi kas dari transaksi transfer piutang/utang baru — independen dari mapping cashflow per akun
          di atas.
        </p>
        <Select
          value={arApCashAccountId}
          onValueChange={(value) => setSyncSettings.mutate({ arApCashAccountId: value ? Number(value) : null })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pilih akun kas...">
              {(value: string | null) =>
                cashAccountOptions.find((a) => String(a.id) === value)?.name ?? "Pilih akun kas..."
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {cashAccountOptions.map((account) => (
              <SelectItem key={account.id} value={String(account.id)}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Akun Utang Piutang</h3>
        <p className="text-muted-foreground text-sm">
          Piutang dan utang gabungan dari Retailku dicatat lewat akun bertipe &quot;Utang Piutang&quot; ini
          — buat dulu di Master Data &gt; Akun kalau belum ada.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Akun untuk Piutang</Label>
            <Select
              value={receivableDebtAccountId}
              onValueChange={(value) =>
                setSyncSettings.mutate({ receivableDebtAccountId: value ? Number(value) : null })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih akun...">
                  {(value: string | null) =>
                    debtAccountOptions.find((a) => String(a.id) === value)?.name ?? "Pilih akun..."
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {debtAccountOptions.map((account) => (
                  <SelectItem key={account.id} value={String(account.id)}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Akun untuk Utang</Label>
            <Select
              value={payableDebtAccountId}
              onValueChange={(value) =>
                setSyncSettings.mutate({ payableDebtAccountId: value ? Number(value) : null })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih akun...">
                  {(value: string | null) =>
                    debtAccountOptions.find((a) => String(a.id) === value)?.name ?? "Pilih akun..."
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {debtAccountOptions.map((account) => (
                  <SelectItem key={account.id} value={String(account.id)}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Titik Awal Sync</h3>
        <p className="text-muted-foreground text-sm">
          Sync berikutnya memproses dari tanggal ini sampai hari ini. Maju otomatis setelah sync berhasil —
          bisa diedit manual kapan saja.
        </p>
        {syncSettingsLoading ? (
          <p className="text-muted-foreground text-sm">Memuat...</p>
        ) : (
          <div className="flex items-end gap-2">
            <Input
              type="date"
              value={syncFromValue}
              onChange={(e) => setSyncFromDraft(e.target.value)}
              className="w-fit"
            />
            {syncFromDraft != null && syncFromDraft !== syncSettings?.syncFrom && (
              <Button variant="outline" size="sm" onClick={handleSaveSyncFrom} disabled={setSyncSettings.isPending}>
                Simpan
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor="auto-sync-toggle">Sync Otomatis Saat App Dibuka</Label>
          <p className="text-muted-foreground text-sm">
            Maksimal 1x per hari, gagal dilaporkan lewat notifikasi tanpa mengganggu.
          </p>
        </div>
        <Switch
          id="auto-sync-toggle"
          checked={syncSettings?.autoSyncEnabled ?? true}
          onCheckedChange={(checked) => setSyncSettings.mutate({ autoSyncEnabled: checked })}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Status Sinkronisasi</h3>
        <p className="text-muted-foreground text-sm">
          {syncSettings?.lastAutoSyncDate
            ? `Sync otomatis terakhir: ${syncSettings.lastAutoSyncDate}`
            : "Belum pernah disinkron otomatis."}
        </p>
      </div>

      <Button onClick={handleSyncNow} disabled={!canSync || syncAll.isPending}>
        {syncAll.isPending ? "Menyinkronkan..." : "Sync Sekarang"}
      </Button>
    </div>
  );
}
