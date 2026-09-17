"use client";

import { TablePagination } from "@/components/table-pagination";
import { useList } from "./list-context";

export function ListCardFooter() {
  const { pagination, setPage, setLimit } = useList();

  if (!pagination || pagination.total === 0) return null;

  return (
    <TablePagination
      pagination={pagination}
      onPageChange={setPage}
      onLimitChange={(newLimit) => {
        setLimit(newLimit);
        setPage(1);
      }}
    />
  );
}
