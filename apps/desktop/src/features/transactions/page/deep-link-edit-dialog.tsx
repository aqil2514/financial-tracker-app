"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { TransactionEditDialog } from "../form";
import { useTransactionById } from "../content/list/use-transaction-by-id";

/** Buka TransactionEditDialog otomatis kalau halaman diakses dengan
 * ?edit=<id> di URL — dipakai untuk navigasi "Edit" dari tempat lain
 * (mis. dialog detail akun) yang cuma tahu id transaksi, bukan objeknya. */
export function DeepLinkEditDialog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const transactionId = editId ? Number(editId) : null;

  const { data: transaction } = useTransactionById(transactionId);

  function handleOpenChange(open: boolean) {
    if (!open) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("edit");
      router.replace(params.size > 0 ? `/transactions?${params}` : "/transactions");
    }
  }

  if (!transaction) return null;

  return (
    <TransactionEditDialog transaction={transaction} open={true} onOpenChange={handleOpenChange} />
  );
}
