import { PageHeader } from "@/components/page-header";
import { Filter } from "./filter";

export function Header() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Mapping Retailku"
        description="Atur akun tujuan, judul, dan kategori transaksi otomatis untuk tiap jenis pergerakan kas Retailku. Muat dulu jenis-jenis yang muncul pada rentang tanggal tertentu, lalu lengkapi yang belum dipetakan."
      />
      <Filter />
    </div>
  );
}
