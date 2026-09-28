import { useRetailkuSyncCashflowMapping } from "../context";

export function ErrorComponent() {
  const { loadKeysError } = useRetailkuSyncCashflowMapping().loads;

  return (
    <p className="text-destructive text-sm">
      Gagal memuat:{" "}
      {loadKeysError instanceof Error
        ? loadKeysError.message
        : String(loadKeysError)}
    </p>
  );
}

export function NoDataComponent() {
  return (
    <p className="text-muted-foreground text-sm">
      Belum ada data. Tekan &quot;Muat Jenis Transaksi&quot; untuk melihat jenis
      pergerakan kas pada rentang tanggal di atas.
    </p>
  );
}
