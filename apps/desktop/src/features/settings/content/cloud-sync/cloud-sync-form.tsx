"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCloudSyncForm } from "./use-cloud-sync-form";

/**
 * Kredensial + toggle untuk cloud sync (lihat
 * apps/desktop/docs/todos/plan/mcp-server-cloud-mirror.md) — URL Worker
 * dan token ditempel manual dari hasil setup `wrangler` sendiri (BELUM
 * ada UI "generate otomatis", beda dari Retailku yang bisa daftar
 * sendiri lewat dashboard pihak ketiga). Help text di tiap field
 * sengaja eksplisit menyebut dari mana nilainya berasal — fitur ini
 * cuma masuk akal dipakai orang yang sudah/akan deploy Worker-nya
 * sendiri, bukan user awam yang tinggal isi sembarang. Toggle EKSPLISIT
 * (bukan implisit dari kelengkapan field) karena begitu ON, push
 * on-write langsung mulai mengirim data ke internet. Logic ada di
 * `useCloudSyncForm` — komponen ini murni render.
 */
export function CloudSyncForm() {
  const {
    enabled,
    setEnabled,
    workerUrl,
    setWorkerUrl,
    token,
    setToken,
    isLoading,
    canTest,
    canEnable,
    isSaving,
    testState,
    handleSave,
    handleTestConnection,
  } = useCloudSyncForm();

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Sinkronkan data keuangan ke server Cloudflare (Worker) pribadi
        supaya bisa dikelola dari HP lewat asisten AI yang mendukung MCP
        (Model Context Protocol). Fitur ini butuh Worker yang sudah
        di-deploy sendiri lebih dulu (lihat{" "}
        <code className="text-xs">apps/worker</code> di repo) — bukan
        layanan pihak ketiga yang bisa didaftar lewat form ini.
      </p>
      <div className="space-y-2">
        <Label htmlFor="cloud-sync-worker-url">URL Worker</Label>
        <Input
          id="cloud-sync-worker-url"
          placeholder="https://financial-app-worker.example.workers.dev"
          value={workerUrl}
          onChange={(e) => setWorkerUrl(e.target.value)}
          disabled={isLoading}
        />
        <p className="text-muted-foreground text-xs">
          Alamat Worker setelah di-deploy (muncul di output{" "}
          <code>wrangler deploy</code>, atau cek dashboard Cloudflare →
          Workers &amp; Pages).
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cloud-sync-token">Token</Label>
        <Input
          id="cloud-sync-token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={isLoading}
        />
        <p className="text-muted-foreground text-xs">
          Kata sandi rahasia yang dibuat sendiri saat setup Worker (secret{" "}
          <code>PC_SYNC_TOKEN</code>) — bukan dibuat otomatis dari sini,
          harus sama persis dengan yang didaftarkan ke Worker.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={isLoading || !canEnable}
        />
        <span>Aktifkan cloud sync</span>
      </label>
      {!canEnable && (
        <p className="text-muted-foreground pl-8 text-xs">
          Isi URL Worker dan token dulu sebelum toggle bisa diaktifkan.
        </p>
      )}
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
      </div>
      {testState.status === "success" && (
        <p className="text-sm text-green-600">Berhasil terhubung ke Worker.</p>
      )}
      {testState.status === "error" && (
        <p className="text-destructive text-sm">
          Gagal terhubung — periksa URL dan token.
        </p>
      )}
    </div>
  );
}
