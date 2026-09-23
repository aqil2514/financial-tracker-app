import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * SEMENTARA DINONAKTIFKAN (2026-09-23) — `AccountMappingList` lama
 * (dan seluruh hook di baliknya: `useRetailkuAccountMapping`,
 * `useSaveRetailkuAccountMapping`, `useRetailkuMappingIssues`,
 * `use-account-mapping-draft.ts`) query ke tabel `retailku_account_mapping`
 * yang SUDAH DI-DROP migrasi `0020_retailku_sync_field_mapping.sql` —
 * digantikan `retailku_sync_field_mapping`, lihat
 * docs/todos/plan/retailku-sync-field-mapping.md. Kalau dirender
 * apa adanya, akan error runtime (query ke tabel yang tidak ada lagi).
 *
 * UI pengganti (tab konfigurasi mapping key→field di halaman sync,
 * BUKAN halaman terpisah seperti ini) BELUM dibangun — dikerjakan
 * terpisah dari migrasi backend ini (keputusan eksplisit: "migrasi +
 * backend saja dulu, UI menyusul"). JANGAN hapus `AccountMappingList`/
 * `use-account-mapping-draft.ts`/dst — jadi referensi pola UI
 * (dropdown akun, deteksi orphan mapping) saat UI baru dibangun.
 *
 * Konsekuensi nyata selama UI belum ada: sync akan skip SEMUA baris
 * dengan `skipReason: "unmapped-account"` (key belum ada mapping-nya
 * sama sekali) sampai baris `retailku_sync_field_mapping` diisi
 * manual (lewat SQL langsung) atau UI baru selesai.
 */
export default function RetailkuMappingPage() {
  return (
    <PageContainer maxWidth="6xl">
      <PageHeader
        title="Mapping Akun Retailku"
        description="Hubungkan akun kas/bank Retailku ke akun lokal financial-app"
      />
      <Card>
        <CardHeader>
          <CardTitle>Sedang dikembangkan ulang</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Halaman ini sedang dibangun ulang untuk mendukung pengaturan judul dan kategori transaksi
            otomatis, bukan cuma akun tujuan. Sementara ini belum bisa dipakai — sync akan melewati
            transaksi yang belum ada mapping-nya sampai halaman ini selesai.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
