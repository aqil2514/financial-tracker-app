import { PageHeader } from "@/components/page-header";

export function Header() {
  return (
    <PageHeader
      title="Konfigurasi Sync Retailku"
      description="Atur mode sync, akun tujuan, dan titik awal sinkronisasi cashflow Retailku. Perubahan tiap section perlu disimpan sendiri sebelum berlaku untuk sync berikutnya."
    />
  );
}
