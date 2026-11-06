export type TransactionType = "income" | "expense" | "transfer";

export interface TransactionListItem {
  id: string;
  note: string;
  description: string | null;
  type: TransactionType;
  category: string | null;
  account: string;
  transferAccount: string | null;
  amount: number;
  date: string;
  hasAttachment: boolean;
  // Label efektif (milik transaksi, atau kategorinya kalau kosong). Hanya diisi oleh daftar Transaksi.
  labels?: string[];
}