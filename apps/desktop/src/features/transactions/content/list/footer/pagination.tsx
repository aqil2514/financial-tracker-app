"use client";

import { TablePagination } from "@/components/query/pagination";
import { useList } from "../context";

export function ListCardPagination() {
  const { pagination } = useList().data;
  const { setPage, setLimit } = useList().pageControl;

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
