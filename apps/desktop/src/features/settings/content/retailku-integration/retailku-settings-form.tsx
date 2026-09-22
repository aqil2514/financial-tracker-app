"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRetailkuSettingsForm } from "./use-retailku-settings-form";

/**
 * Kredensial untuk sinkronisasi Retailku (lihat
 * docs/todos/plan/retailku-integration.md) — 2 field saja, keduanya
 * disalin apa adanya dari halaman Settings → API Keys di Retailku:
 * URL MCP (sudah dalam bentuk siap pakai, mis.
 * "https://api.retailku.com/warung-aqil/mcp") dan API key yang dibuat
 * di halaman yang sama. Fondasi awal — belum ada logic sync otomatis,
 * cuma penyimpanan kredensial + tombol "Tes Koneksi" untuk verifikasi
 * manual bahwa MCP client bisa terhubung. Logic ada di
 * `useRetailkuSettingsForm` — komponen ini murni render.
 */
export function RetailkuSettingsForm() {
  const {
    mcpUrl,
    setMcpUrl,
    apiKey,
    setApiKey,
    isLoading,
    isConnected,
    canTest,
    isSaving,
    testState,
    handleSave,
    handleTestConnection,
  } = useRetailkuSettingsForm();

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Hubungkan ke toko Retailku untuk sinkronisasi transaksi bisnis
        secara otomatis. Buka Settings → API Keys di Retailku, salin URL
        MCP dan buat API key baru, lalu tempel di bawah ini.
      </p>
      <div className="space-y-2">
        <Label htmlFor="retailku-mcp-url">URL MCP</Label>
        <Input
          id="retailku-mcp-url"
          placeholder="https://api.retailku.com/nama-toko/mcp"
          value={mcpUrl}
          onChange={(e) => setMcpUrl(e.target.value)}
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="retailku-api-key">API Key</Label>
        <Input
          id="retailku-api-key"
          type="password"
          placeholder="sk_..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={isLoading}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleSave} disabled={isLoading || isSaving}>
          {isSaving ? "Menyimpan..." : "Simpan"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleTestConnection}
          disabled={!canTest || testState.status === "testing"}
        >
          {testState.status === "testing" ? "Menguji..." : "Tes Koneksi"}
        </Button>
        {isConnected && (
          <span className="text-muted-foreground text-xs">Tersimpan</span>
        )}
      </div>
      {testState.status === "success" && (
        <p className="text-sm text-green-600">
          Berhasil terhubung — {testState.toolCount} tools tersedia.
        </p>
      )}
      {testState.status === "error" && (
        <p className="text-destructive text-sm">Gagal terhubung: {testState.message}</p>
      )}
    </div>
  );
}
