"use client";

import { useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { QueryState } from "@/components/query-state";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import { FilterPanel } from "@/components/query/filters/panel";
import type { FilterKeyOption, SelectOptionsMap } from "@/components/query/filters/panel/panel.interface";
import { SortDropdown, type SortConfig, type SortKeyOption } from "@/components/query/sort";
import { useAccounts } from "@/hooks/resources";
import { useDeleteTransaction } from "@/features/transactions";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { EditThirdPartyFundDialog } from "./edit-form/edit-third-party-fund-dialog";
import { useThirdPartyFunds, type ThirdPartyFundRow } from "./use-third-party-funds";

const DIRECTION_LABEL: Record<"in" | "out", string> = {
  in: "Titip",
  out: "Ambil",
};

// Key SUDAH diprefix `third_party_funds.` -- harus sama persis dengan
// FILTERABLE_COLUMNS/SORTABLE_COLUMNS di use-third-party-funds.ts (lihat
// komentar di sana soal kenapa prefix wajib ada, bukan sekadar gaya).
const FILTER_CONFIG: FilterKeyOption[] = [
  { key: "third_party_funds.direction", label: "Arah", type: "select" },
  { key: "third_party_funds.account_id", label: "Akun", type: "select" },
];

const SORT_CONFIG: SortKeyOption[] = [
  { key: "third_party_funds.date", label: "Tanggal" },
  { key: "third_party_funds.amount", label: "Jumlah" },
];

function useFilterSelectOptions(): SelectOptionsMap {
  const { data: accounts } = useAccounts();

  return useMemo(
    () => ({
      "third_party_funds.direction": [
        { value: "in", label: "Titip" },
        { value: "out", label: "Ambil" },
      ],
      "third_party_funds.account_id": (accounts ?? [])
        .filter((account) => account.account_type === "third_party")
        .map((account) => ({ value: account.id, label: account.name })),
    }),
    [accounts]
  );
}

export function ThirdPartyFundList() {
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [sorts, setSorts] = useState<SortConfig[]>([]);
  const selectOptions = useFilterSelectOptions();
  const { data: funds, isLoading, error } = useThirdPartyFunds(filters, sorts);
  const [editingFund, setEditingFund] = useState<ThirdPartyFundRow | null>(null);
  const [deletingFund, setDeletingFund] = useState<ThirdPartyFundRow | null>(null);
  const deleteTransaction = useDeleteTransaction();

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <FilterPanel
        config={FILTER_CONFIG}
        selectOptions={selectOptions}
        initialValue={filters}
        onApplyFilter={setFilters}
      />
      <SortDropdown config={SORT_CONFIG} value={sorts} onChange={setSorts} />
    </div>
  );

  if (isLoading || error) {
    return (
      <div className="space-y-4">
        {toolbar}
        <Card>
          <CardContent>
            <QueryState isLoading={isLoading} error={error} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!funds || funds.length === 0) {
    return (
      <div className="space-y-4">
        {toolbar}
        <Card>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              {filters.length > 0
                ? "Tidak ada riwayat yang cocok dengan filter."
                : "Belum ada riwayat titip/ambil. Catat lewat tombol di atas."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {toolbar}
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y">
            {funds.map((fund) => {
              const Icon = fund.direction === "in" ? ArrowUpCircle : ArrowDownCircle;
              const iconColor = fund.direction === "in" ? "text-emerald-600" : "text-red-600";
              // Edit HANYA utk baris direct (income/expense, 1 baris per
              // transaksi) -- baris transfer (2 baris berpasangan out+in)
              // BELUM didukung dialog edit ringkas ini, lihat
              // docs/todos/plan/account-type-third-party.md.
              const canEdit = fund.transaction_type === "income" || fund.transaction_type === "expense";

              return (
                <li key={fund.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className={`size-5 shrink-0 ${iconColor}`} />
                    <div>
                      <p className="font-medium">
                        {DIRECTION_LABEL[fund.direction]} — {fund.contact_name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {fund.account_name} · {formatDate(fund.date, "date-time")}
                      </p>
                      {fund.note && <p className="text-muted-foreground text-xs">{fund.note}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={`font-medium ${iconColor}`}>
                      {fund.direction === "in" ? "+" : "-"}
                      {formatCurrency(fund.amount, "IDR")}
                    </p>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => setEditingFund(fund)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive size-7"
                      onClick={() => setDeletingFund(fund)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {editingFund && (
        <EditThirdPartyFundDialog
          fund={editingFund}
          open={editingFund != null}
          onOpenChange={(next) => {
            if (!next) setEditingFund(null);
          }}
        />
      )}

      <ConfirmDeleteDialog
        open={deletingFund != null}
        onOpenChange={(next) => {
          if (!next) setDeletingFund(null);
        }}
        onConfirm={() => {
          if (!deletingFund?.transaction_id) return;
          deleteTransaction.mutate(deletingFund.transaction_id, {
            onSuccess: () => setDeletingFund(null),
          });
        }}
        isPending={deleteTransaction.isPending}
        title="Hapus riwayat ini?"
        description={
          deletingFund?.transaction_type === "transfer"
            ? "Ini bagian dari perpindahan tempat/kepemilikan — baris pasangannya (sisi keluar/masuk) ikut terhapus sekaligus. Tindakan ini tidak bisa dibatalkan."
            : "Transaksi jejaknya ikut terhapus. Tindakan ini tidak bisa dibatalkan."
        }
      />
    </>
  );
}
