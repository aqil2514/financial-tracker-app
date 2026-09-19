"use client";

import { ArrowDownCircle, ArrowLeftRight, ArrowUpCircle } from "lucide-react";

import { formatCurrency } from "@/lib/format-currency";
import { useAccountDetail } from "../detail-context";
import { useAccountMonthSummary } from "./use-account-month-summary";

/** 3 kartu statistik (Pemasukan, Pengeluaran, Transfer) khusus akun ini
 * pada bulan yang dipilih lewat MonthPicker — ringkasan sesaat, bukan
 * tren multi-bulan (yang lebih lengkap ada di halaman Laporan). Transfer
 * dipisah dari income/expense karena bukan kategori akuntansi yang sama,
 * tapi tetap menggerakkan saldo akun ini (net masuk - keluar). */
export function AccountMonthStats({ accountId }: { accountId: number }) {
  const { selectedMonth } = useAccountDetail();
  const { data } = useAccountMonthSummary(accountId, selectedMonth);

  if (!data) return null;

  if (data.income === 0 && data.expense === 0 && data.transfer === 0) {
    return (
      <p className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
        Tidak ada transaksi pada bulan ini.
      </p>
    );
  }

  return (
    <div className="flex flex-1 flex-col justify-center gap-3">
      <StatCard
        icon={ArrowUpCircle}
        label="Pemasukan"
        value={formatCurrency(data.income, "IDR")}
        className="text-green-600"
      />
      <StatCard
        icon={ArrowDownCircle}
        label="Pengeluaran"
        value={formatCurrency(data.expense, "IDR")}
        className="text-red-600"
      />
      <StatCard
        icon={ArrowLeftRight}
        label="Transfer"
        value={`${data.transfer >= 0 ? "+" : ""}${formatCurrency(data.transfer, "IDR")}`}
        className="text-blue-600"
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof ArrowUpCircle;
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <Icon className={`size-8 shrink-0 ${className}`} />
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={`text-lg font-semibold ${className}`}>{value}</p>
      </div>
    </div>
  );
}
