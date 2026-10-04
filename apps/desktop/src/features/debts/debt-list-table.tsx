"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Ban, HandCoins, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { ListItemActionsMenu } from "@/components/list-item-actions-menu";
import { TablePagination } from "@/components/query/pagination";
import { FilterPanel } from "@/components/query/filters/panel";
import type { FilterKeyOption, SelectOptionsMap } from "@/components/query/filters/panel/panel.interface";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import { SortDropdown } from "@/components/query/sort";
import type { SortConfig, SortKeyOption } from "@/components/query/sort";
import { PeriodPicker } from "@/components/query/period-picker";
import { useAccounts } from "@/hooks/resources/use-accounts";
import { useContacts } from "@/shared/contacts/use-contacts";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { useDebtsList, type DebtListRow } from "@/shared/debts/use-debts-list";
import { PayDebtDialog } from "@/shared/debts/pay-debt-form/pay-debt-dialog";
import { useWriteOffDebt } from "@/shared/debts/use-write-off-debt";
import { DEBT_STATUS_LABEL, DEBT_STATUS_VARIANT } from "@/shared/debts/status-labels";

const DEFAULT_LIMIT = 10;

// Harus sinkron dengan FILTERABLE_COLUMNS di use-debts-list.ts.
const FILTER_CONFIG: FilterKeyOption[] = [
  { key: "status", label: "Status", type: "select" },
  { key: "contact_id", label: "Kontak", type: "combobox" },
  { key: "account_id", label: "Akun", type: "combobox" },
];

// Harus sinkron dengan SORTABLE_COLUMNS di use-debts-list.ts.
const SORT_CONFIG: SortKeyOption[] = [
  { key: "debts.date", label: "Tanggal" },
  { key: "debts.amount", label: "Pokok" },
  { key: "remaining", label: "Sisa" },
  { key: "contact_name", label: "Kontak" },
  { key: "account_name", label: "Akun" },
];

export function DebtListTable({ type }: { type: "receivable" | "payable" }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [sorts, setSorts] = useState<SortConfig[]>([]);
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | undefined>();
  const { data, isLoading } = useDebtsList(type, page, limit, filters, sorts, dateRange);
  const [payingDebt, setPayingDebt] = useState<DebtListRow | null>(null);
  const [writingOffDebt, setWritingOffDebt] = useState<DebtListRow | null>(null);
  const writeOffDebt = useWriteOffDebt();

  const { data: contacts } = useContacts();
  const { data: accounts } = useAccounts();

  useEffect(() => {
    setPage(1);
  }, [filters, sorts, dateRange]);

  const filterSelectOptions = useMemo<SelectOptionsMap>(
    () => ({
      status: Object.entries(DEBT_STATUS_LABEL).map(([value, label]) => ({ value, label })),
      contact_id: (contacts ?? []).map((contact) => ({
        value: String(contact.id),
        label: contact.name,
      })),
      account_id: (accounts ?? []).map((account) => ({
        value: String(account.id),
        label: account.name,
      })),
    }),
    [contacts, accounts]
  );

  const periodValue = useMemo<DateRange | undefined>(
    () =>
      dateRange
        ? { from: new Date(`${dateRange.from}T00:00`), to: new Date(`${dateRange.to}T00:00`) }
        : undefined,
    [dateRange]
  );

  function handlePeriodChange(range: DateRange | undefined) {
    if (!range?.from || !range.to) {
      setDateRange(undefined);
      return;
    }
    setDateRange({ from: format(range.from, "yyyy-MM-dd"), to: format(range.to, "yyyy-MM-dd") });
  }

  const hasActiveQuery = filters.length > 0 || sorts.length > 0 || dateRange != null;

  function handleReset() {
    setFilters([]);
    setSorts([]);
    setDateRange(undefined);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SortDropdown config={SORT_CONFIG} value={sorts} onChange={setSorts} />
        <FilterPanel
          config={FILTER_CONFIG}
          selectOptions={filterSelectOptions}
          initialValue={filters}
          onApplyFilter={setFilters}
        />
        <PeriodPicker value={periodValue} onChange={handlePeriodChange} />
        {hasActiveQuery && (
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <X className="size-4" />
            Reset
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Memuat...</p>
      ) : !data || data.debts.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Belum ada {type === "receivable" ? "piutang" : "utang"} tercatat.
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-0" />
                <TableHead>Tanggal</TableHead>
                <TableHead>Kontak</TableHead>
                <TableHead>Akun</TableHead>
                <TableHead className="text-right">Pokok</TableHead>
                <TableHead className="text-right">Sisa</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.debts.map((debt) => (
                <TableRow key={debt.id}>
                  <TableCell>
                    {debt.status === "ongoing" && (
                      <ListItemActionsMenu
                        actions={[
                          {
                            label: type === "receivable" ? "Catat Pelunasan" : "Catat Pembayaran",
                            icon: HandCoins,
                            onClick: () => setPayingDebt(debt),
                          },
                          {
                            label: "Tandai Dihapuskan",
                            icon: Ban,
                            variant: "destructive",
                            onClick: () => setWritingOffDebt(debt),
                          },
                        ]}
                      />
                    )}
                  </TableCell>
                  <TableCell>{formatDate(debt.date, "date-time")}</TableCell>
                  <TableCell>{debt.contact_name ?? "—"}</TableCell>
                  <TableCell>{debt.account_name ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(debt.amount, "IDR")}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(debt.remaining, "IDR")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={DEBT_STATUS_VARIANT[debt.status]}>
                      {DEBT_STATUS_LABEL[debt.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            pagination={data.pagination}
            onPageChange={setPage}
            onLimitChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
          />
        </>
      )}

      {payingDebt && (
        <PayDebtDialog
          debt={payingDebt}
          open={payingDebt != null}
          onOpenChange={(next) => {
            if (!next) setPayingDebt(null);
          }}
        />
      )}

      <ConfirmDeleteDialog
        open={writingOffDebt != null}
        onOpenChange={(next) => {
          if (!next) setWritingOffDebt(null);
        }}
        onConfirm={() => {
          if (!writingOffDebt) return;
          writeOffDebt.mutate(writingOffDebt, { onSuccess: () => setWritingOffDebt(null) });
        }}
        isPending={writeOffDebt.isPending}
        title={`Tandai ${type === "receivable" ? "piutang" : "utang"} ini dihapuskan?`}
        description="Dipakai untuk kasus yang bukan pelunasan penuh (mis. diikhlaskan) — tidak ada transaksi yang dibuat, sisa berhenti dihitung aktif. Tindakan ini tidak bisa dibatalkan."
      />
    </>
  );
}
