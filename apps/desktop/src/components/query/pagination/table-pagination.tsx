"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Pagination } from "@/lib/pagination";

type TablePaginationProps = {
  pagination: Pagination;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  limitOptions?: number[];
};

export const ELLIPSIS = "…" as const;

export function buildPageList(
  page: number,
  totalPages: number
): (number | typeof ELLIPSIS)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const result: (number | typeof ELLIPSIS)[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push(ELLIPSIS);
    }
    result.push(sorted[i]);
  }
  return result;
}

export function TablePagination({
  pagination,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 20, 30, 40, 50],
}: TablePaginationProps) {
  const pageList = buildPageList(pagination.page, pagination.totalPages);
  const [pageInput, setPageInput] = useState(String(pagination.page));
  const inputWidthCh = String(pagination.totalPages).length + 2;

  useEffect(() => {
    setPageInput(String(pagination.page));
  }, [pagination.page]);

  function submitPageInput() {
    const parsed = Number(pageInput);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= pagination.totalPages) {
      onPageChange(parsed);
    } else {
      setPageInput(String(pagination.page));
    }
  }

  function handlePageInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      submitPageInput();
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-y-2 px-2 py-4">
      <div className="text-muted-foreground text-sm">
        Total {pagination.total} data
      </div>
      <div className="flex items-center gap-4 lg:gap-8">
        <div className="flex items-center space-x-2">
          <p className="hidden text-sm font-medium sm:block">
            Baris per halaman
          </p>
          <Select
            value={`${pagination.limit}`}
            onValueChange={(value) => onLimitChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-17.5">
              <SelectValue placeholder={pagination.limit} />
            </SelectTrigger>
            <SelectContent side="top">
              {limitOptions.map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-1">
          <Button
            variant="outline"
            className="hidden size-8 p-0 lg:flex"
            onClick={() => onPageChange(1)}
            disabled={pagination.page <= 1}
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="size-8 p-0"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
          >
            <ChevronLeft className="size-4" />
          </Button>
          {pageList.map((p, i) =>
            p === ELLIPSIS ? (
              <span
                key={`ellipsis-${i}`}
                className="text-muted-foreground w-8 text-center text-sm"
              >
                {ELLIPSIS}
              </span>
            ) : p === pagination.page ? (
              <Input
                key={p}
                type="number"
                min={1}
                max={pagination.totalPages}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={handlePageInputKeyDown}
                onBlur={submitPageInput}
                style={{ width: `${inputWidthCh}ch` }}
                className="h-8 min-w-8 px-1.5 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            ) : (
              <Button
                key={p}
                variant="outline"
                className="size-8 p-0"
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            )
          )}
          <Button
            variant="outline"
            className="size-8 p-0"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden size-8 p-0 lg:flex"
            onClick={() => onPageChange(pagination.totalPages)}
            disabled={pagination.page >= pagination.totalPages}
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
