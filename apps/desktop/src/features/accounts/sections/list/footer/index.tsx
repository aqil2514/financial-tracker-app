"use client";

import { TablePagination } from "@/components/query/pagination";
import { useAccountsList } from "../accounts-context";

export function AccountsCardFooter() {
  const { pagination, setPage, setLimit } = useAccountsList();

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
