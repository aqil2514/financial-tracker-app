"use client";

import { useAccounts } from "@/features/accounts";
import { DeleteAccountDialog } from "@/features/accounts";
import { useThirdPartyAccountDialog } from "./context";

/** Hapus akun `third_party` — reuse PENUH `DeleteAccountDialog` dari
 * `features/accounts` (sama seperti pola Edit, lihat edit.tsx). Guard
 * "tidak boleh hapus kalau masih ada riwayat titip/ambil" sudah
 * diimplementasikan DI DALAM `DeleteAccountDialog` generik itu sendiri
 * (useThirdPartyFundCount, lihat
 * features/accounts/contents/detail/dialog/delete/) — bukan di sini,
 * supaya berlaku juga kalau user menghapus akun third_party dari
 * halaman Akun biasa (bukan cuma dari tab ini). */
export function ThirdPartyDeleteAccountDialog() {
  const { dialog, closeDialog } = useThirdPartyAccountDialog();
  const { data: accounts } = useAccounts();

  const open = dialog?.type === "delete";
  const account = open ? accounts?.find((a) => a.id === dialog.dataId) : undefined;

  if (!account) return null;

  return (
    <DeleteAccountDialog
      account={account}
      open={open}
      onOpenChange={(next) => !next && closeDialog()}
    />
  );
}
