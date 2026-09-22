"use client";

import { useAccountDetailPage } from "../page/account-detail-page-context";

/** Placeholder fondasi — badan halaman detail akun (transaksi scoped ke
 * akun ini, dst) menyusul di fase berikutnya. */
export function AccountDetailContent() {
  const { account, isLoading } = useAccountDetailPage();

  if (isLoading) return null;

  if (!account) {
    return (
      <p className="text-muted-foreground text-sm">
        Akun ini tidak ditemukan — mungkin sudah dihapus.
      </p>
    );
  }

  return (
    <p className="text-muted-foreground text-sm">
      Konten detail akun "{account.name}" menyusul di sini.
    </p>
  );
}
