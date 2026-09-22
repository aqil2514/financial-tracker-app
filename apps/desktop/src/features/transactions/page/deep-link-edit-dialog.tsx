"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useTransactionsDialog } from "../dialog";

/** Buka dialog edit transaksi (context dialog fitur) otomatis kalau
 * halaman diakses dengan ?edit=<id> di URL — dipakai untuk navigasi
 * "Edit" dari tempat lain (mis. dialog detail akun) yang cuma tahu id
 * transaksi, bukan objeknya. */
export function DeepLinkEditDialog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const { openDialog, dialog } = useTransactionsDialog();

  useEffect(() => {
    if (editId) openDialog("edit", editId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    // Dialog ditutup dari dalam (tombol X, submit sukses, dst) tanpa
    // ?edit di URL ikut dibersihkan — sinkronkan balik ke URL supaya
    // deep-link tidak terbuka lagi kalau halaman di-refresh.
    if (editId && dialog?.type !== "edit") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("edit");
      router.replace(params.size > 0 ? `/transactions?${params}` : "/transactions");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  return null;
}
