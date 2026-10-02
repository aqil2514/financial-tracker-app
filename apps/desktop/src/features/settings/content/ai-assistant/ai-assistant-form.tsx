"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAiAssistantForm } from "./use-ai-assistant-form";

async function copyToClipboard(value: string) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  toast.success("Disalin ke clipboard");
}

/**
 * URL + token apps/mcp-server utk ditempel ke client MCP (Claude
 * Desktop/Web, dll) saat setup koneksi. PC TIDAK PERNAH memanggil
 * mcp-server (beda dari CloudSyncForm yg PC panggil Worker langsung)
 * — form ini murni simpan+tampilkan, makanya tidak ada toggle/tes
 * koneksi. Logic ada di `useAiAssistantForm`, komponen ini murni
 * render.
 */
export function AiAssistantForm() {
  const { serverUrl, setServerUrl, token, setToken, isLoading, isSaving, handleSave } = useAiAssistantForm();

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Kelola data keuangan dari HP lewat asisten AI yang mendukung MCP
        (Model Context Protocol). Isi URL server MCP (hasil deploy{" "}
        <code className="text-xs">apps/mcp-server</code> ke Vercel) dan
        token sinkronisasinya di sini, lalu tempel kedua nilai itu saat
        menghubungkan client MCP Anda — bukan layanan pihak ketiga yang
        bisa didaftar lewat form ini.
      </p>
      <div className="space-y-2">
        <Label htmlFor="ai-assistant-server-url">URL Server MCP</Label>
        <div className="flex gap-2">
          <Input
            id="ai-assistant-server-url"
            placeholder="https://financial-app-mcp.example.vercel.app"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            disabled={isLoading}
          />
          <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(serverUrl)}>
            <Copy />
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Alamat deployment <code>apps/mcp-server</code> di Vercel (bisa
          dicek di dashboard Vercel setelah deploy).
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ai-assistant-token">Token</Label>
        <div className="flex gap-2">
          <Input
            id="ai-assistant-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={isLoading}
          />
          <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(token)}>
            <Copy />
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Kata sandi rahasia yang dibuat sendiri saat setup Worker (secret{" "}
          <code>MCP_SYNC_TOKEN</code>) — bukan dibuat otomatis dari sini,
          harus sama persis dengan yang didaftarkan ke Worker.
        </p>
      </div>
      <Button onClick={handleSave} disabled={isLoading || isSaving}>
        {isSaving ? "Menyimpan..." : "Simpan"}
      </Button>
    </div>
  );
}
