import type { getCashflowDetail } from "@/shared/retailku";
import { aggregateByDateAndAccount } from "./aggregate-by-date-and-account";
import { aggregateByDateAccountAndSourceType } from "./aggregate-by-date-account-and-source-type";
import type { AggregatedTotal, SyncCashflowInput } from "../../types";

/** Gabungkan baris cashflow mentah jadi total per `key` mapping,
 * strateginya tergantung `mode` — `"summary"` per tanggal+akun,
 * selain itu per tanggal+akun+sourceType (lihat masing-masing
 * fungsi utk alasan kenapa arah HARUS masuk `key`). */
export function aggregateTotals(
  rows: Awaited<ReturnType<typeof getCashflowDetail>>["data"],
  mode: SyncCashflowInput["mode"]
): AggregatedTotal[] {
  return mode === "summary" ? aggregateByDateAndAccount(rows) : aggregateByDateAccountAndSourceType(rows);
}
