"use client";

import { ScrollArea } from "@/components/ui/scroll-area";

export type RetailkuPickerListItem = {
  id: string;
  label: string;
  description: string;
  amount?: string;
  note?: string;
  date?: string;
  status?: string;
  fromAccount?: string;
  toAccount?: string;
  fee?: string;
};

export const DUMMY_LIST_ITEMS: RetailkuPickerListItem[] = [
  {
    id: "1",
    label: "TRF-260926-01",
    description: "Rp 500.000",
    amount: "Rp 500.000",
    note: "Setor tunai ke BCA",
    date: "26 Sep 2026",
    status: "POSTED",
    fromAccount: "Kas Toko",
    toAccount: "BCA 1234567890",
    fee: "Rp 0",
  },
  {
    id: "2",
    label: "TRF-260926-02",
    description: "Rp 120.000",
    amount: "Rp 120.000",
    note: "Transfer biaya operasional",
    date: "26 Sep 2026",
    status: "POSTED",
    fromAccount: "BCA 1234567890",
    toAccount: "Seabank",
    fee: "Rp 2.500",
  },
  { id: "3", label: "TRF-260925-04", description: "Rp 75.000" },
  { id: "4", label: "TRF-260925-03", description: "Rp 250.000" },
  { id: "5", label: "TRF-260925-02", description: "Rp 30.000" },
  { id: "6", label: "TRF-260925-01", description: "Rp 1.000.000" },
  { id: "7", label: "TRF-260924-05", description: "Rp 45.000" },
  { id: "8", label: "TRF-260924-04", description: "Rp 90.000" },
  { id: "9", label: "TRF-260924-03", description: "Rp 60.500" },
  { id: "10", label: "TRF-260924-02", description: "Rp 175.000" },
  { id: "11", label: "TRF-260924-01", description: "Rp 320.000" },
  { id: "12", label: "TRF-260923-03", description: "Rp 15.000" },
  { id: "13", label: "TRF-260923-02", description: "Rp 410.000" },
  { id: "14", label: "TRF-260923-01", description: "Rp 88.000" },
  { id: "15", label: "TRF-260922-01", description: "Rp 200.000" },
];

export function ResultList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollArea className="min-h-0 rounded-lg border">
      <ul className="divide-y">
        {DUMMY_LIST_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className={`hover:bg-accent flex w-full items-center justify-between gap-2 p-3 text-left text-sm ${
                selectedId === item.id ? "bg-accent" : ""
              }`}
            >
              <span>{item.label}</span>
              <span className="text-muted-foreground">{item.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
