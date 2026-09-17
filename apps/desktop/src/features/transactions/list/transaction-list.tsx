"use client";

import { useEffect, useState } from "react";
import { Trash2, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight } from "lucide-react";

import { formatRupiah, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TablePagination } from "@/components/table-pagination";
import { FilterPanel } from "@/components/filters/panel";
import type {
  FilterKeyOption,
  SelectOptionsMap,
} from "@/components/filters/panel/panel.interface";
import type { FilterConfig } from "@/components/filters/filter.interface";
import { useAccounts } from "@/features/accounts";
import { useCategories } from "@/features/categories";
import { TransactionEditDialog } from "../form/transaction-edit-dialog";
import { useTransactions } from "./use-transactions";
import { useDeleteTransaction } from "./use-delete-transaction";

const typeConfig = {
  income: { label: "Pemasukan", icon: ArrowUpCircle, className: "text-green-600" },
  expense: { label: "Pengeluaran", icon: ArrowDownCircle, className: "text-red-600" },
  transfer: { label: "Transfer", icon: ArrowLeftRight, className: "text-blue-600" },
};

// TODO: sorter sedang disusun ulang bertahap mengikuti pola panel/
// yang baru, sementara dilepas dari UI.

const FILTER_CONFIG: FilterKeyOption[] = [
  { key: "note", label: "Catatan", type: "text" },
  { key: "type", label: "Tipe Transaksi", type: "select" },
];

const FILTER_SELECT_OPTIONS: SelectOptionsMap = {
  type: [
    { value: "income", label: "Pemasukan" },
    { value: "expense", label: "Pengeluaran" },
    { value: "transfer", label: "Transfer" },
  ],
};

export function TransactionList({ dateFilter }: { dateFilter?: string }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const { data, isLoading, error } = useTransactions(
    page,
    limit,
    dateFilter,
    "date_desc",
    filters
  );

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, filters]);
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const deleteTransaction = useDeleteTransaction();

  const transactions = data?.transactions;

  function accountName(id: number | null) {
    return accounts?.find((account) => account.id === id)?.name ?? "-";
  }

  function categoryName(id: number | null) {
    return categories?.find((category) => category.id === id)?.name ?? null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Daftar Transaksi</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <FilterPanel
            config={FILTER_CONFIG}
            selectOptions={FILTER_SELECT_OPTIONS}
            initialValue={filters}
            onApplyFilter={setFilters}
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="text-muted-foreground text-sm">Memuat...</p>
        )}
        {error && (
          <p className="text-destructive text-sm">
            Gagal memuat: {(error as Error).message}
          </p>
        )}
        <ScrollArea className="h-[480px]">
          <div className="space-y-3 pr-4">
            {transactions?.map((tx) => {
              const config = typeConfig[tx.type];
              const Icon = config.icon;

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`size-5 shrink-0 ${config.className}`} />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {tx.type === "transfer"
                            ? `${accountName(tx.account_id)} → ${accountName(tx.transfer_account_id)}`
                            : accountName(tx.account_id)}
                        </p>
                        {categoryName(tx.category_id) && (
                          <Badge variant="secondary">
                            {categoryName(tx.category_id)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {formatDateTime(tx.date)}
                      </p>
                      {tx.note && (
                        <p className="text-muted-foreground text-xs">
                          {tx.note}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <p className={`mr-2 font-medium ${config.className}`}>
                      {tx.type === "expense" ? "-" : tx.type === "income" ? "+" : ""}
                      {formatRupiah(tx.amount)}
                    </p>
                    <TransactionEditDialog transaction={tx} />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deleteTransaction.mutate(tx.id)}
                      disabled={deleteTransaction.isPending}
                    >
                      <Trash2 className="text-destructive size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {transactions && transactions.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Belum ada transaksi. Tambahkan lewat tombol di atas.
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      {data && data.pagination.total > 0 && (
        <TablePagination
          pagination={data.pagination}
          onPageChange={setPage}
          onLimitChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
        />
      )}
    </Card>
  );
}
