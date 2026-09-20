"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format-currency";
import { useContactSummary } from "@/shared/debts/use-contact-summary";

export function ContactSummaryTable() {
  const { data: summary, isLoading } = useContactSummary();

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Memuat...</p>;
  }

  if (!summary || summary.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum ada kontak yang punya piutang/utang tercatat.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Kontak</TableHead>
          <TableHead className="text-right">Piutang Berjalan</TableHead>
          <TableHead className="text-right">Utang Berjalan</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {summary.map((row) => (
          <TableRow key={row.contact_id}>
            <TableCell>{row.contact_name}</TableCell>
            <TableCell className="text-right">
              {row.receivable_remaining > 0
                ? formatCurrency(row.receivable_remaining, "IDR")
                : "—"}
            </TableCell>
            <TableCell className="text-right">
              {row.payable_remaining > 0
                ? formatCurrency(row.payable_remaining, "IDR")
                : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
