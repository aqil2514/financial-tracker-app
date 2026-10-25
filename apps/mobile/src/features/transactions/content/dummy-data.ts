export type TransactionType = "income" | "expense" | "transfer";

export interface DummyTransaction {
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
}

// Data dummy murni untuk tampilan list — belum tersambung ke
// expo-sqlite atau logic filter/sort apa pun.
export const DUMMY_TRANSACTIONS: DummyTransaction[] = [
  {
    id: "1",
    note: "Gaji bulanan",
    description: null,
    type: "income",
    category: "Gaji",
    account: "BCA",
    transferAccount: null,
    amount: 8_500_000,
    date: "2026-10-25",
    hasAttachment: false,
  },
  {
    id: "2",
    note: "Makan siang",
    description: "Warteg dekat kantor",
    type: "expense",
    category: "Makanan",
    account: "Cash",
    transferAccount: null,
    amount: 25_000,
    date: "2026-10-25",
    hasAttachment: true,
  },
  {
    id: "3",
    note: "Transfer ke tabungan",
    description: null,
    type: "transfer",
    category: null,
    account: "BCA",
    transferAccount: "Tabungan BRI",
    amount: 1_000_000,
    date: "2026-10-24",
    hasAttachment: false,
  },
  {
    id: "4",
    note: "Beli token listrik",
    description: null,
    type: "expense",
    category: "Utilitas",
    account: "Cash",
    transferAccount: null,
    amount: 150_000,
    date: "2026-10-23",
    hasAttachment: true,
  },
  {
    id: "5",
    note: "Jual barang bekas",
    description: "Laptop lama",
    type: "income",
    category: "Lainnya",
    account: "BCA",
    transferAccount: null,
    amount: 2_200_000,
    date: "2026-10-22",
    hasAttachment: false,
  },
  {
    id: "6",
    note: "Belanja bulanan",
    description: "Supermarket",
    type: "expense",
    category: "Rumah Tangga",
    account: "BCA",
    transferAccount: null,
    amount: 650_000,
    date: "2026-10-21",
    hasAttachment: true,
  },
  {
    id: "7",
    note: "Bayar kos",
    description: null,
    type: "expense",
    category: "Tempat Tinggal",
    account: "Tabungan BRI",
    transferAccount: null,
    amount: 1_200_000,
    date: "2026-10-20",
    hasAttachment: false,
  },
];
