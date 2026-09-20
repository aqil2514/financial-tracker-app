"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { useDebtsList } from "@/shared/debts/use-debts-list";

const STATUS_LABEL: Record<string, string> = {
  ongoing: "Berjalan",
  paid: "Lunas",
  written_off: "Dihapuskan",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ongoing: "default",
  paid: "secondary",
  written_off: "outline",
};

export function DebtListTable({ type }: { type: "receivable" | "payable" }) {
  const { data: debts, isLoading } = useDebtsList(type);

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Memuat...</p>;
  }

  if (!debts || debts.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum ada {type === "receivable" ? "piutang" : "utang"} tercatat.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tanggal</TableHead>
          <TableHead>Kontak</TableHead>
          <TableHead>Akun</TableHead>
          <TableHead className="text-right">Pokok</TableHead>
          <TableHead className="text-right">Sisa</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {debts.map((debt) => (
          <TableRow key={debt.id}>
            <TableCell>{formatDate(debt.date, "date-time")}</TableCell>
            <TableCell>{debt.contact_name ?? "—"}</TableCell>
            <TableCell>{debt.account_name ?? "—"}</TableCell>
            <TableCell className="text-right">{formatCurrency(debt.amount, "IDR")}</TableCell>
            <TableCell className="text-right">
              {formatCurrency(debt.remaining, "IDR")}
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[debt.status]}>
                {STATUS_LABEL[debt.status]}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
