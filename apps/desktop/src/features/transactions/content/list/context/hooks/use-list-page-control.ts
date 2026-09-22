import { useState } from "react";

/** `page`/`limit` mentah tidak diekspos ke context (tidak ada consumer
 * yang butuh nilainya langsung, cuma setter-nya) — tapi tetap dikembalikan
 * di sini karena `ListProvider` butuh nilainya untuk memanggil
 * `useTransactions`. */
export function useListPageControl() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  return { page, setPage, limit, setLimit };
}
