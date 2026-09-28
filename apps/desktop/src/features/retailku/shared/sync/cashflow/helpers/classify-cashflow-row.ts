import type { getCashflowDetail } from "@/shared/retailku";

export type CashflowRowClassification = "generic" | "ar-ap" | "provider-payout" | "consignment" | "transfer";

/** Satu sumber kebenaran "baris ini generik atau butuh jalur khusus" —
 * dipakai baik agregasi generik (exclude) maupun jalur ekstraksi
 * khusus (include). Alasan tiap syarat: docs/reference/retailku-cashflow-row-classification.md */
export function classifyCashflowRow(
  row: Awaited<ReturnType<typeof getCashflowDetail>>["data"][number]
): CashflowRowClassification {
  if (row.isReceivablePayableAccount) return "ar-ap";
  if (row.isProviderPayoutAccount && row.sourceType === "SALE") return "provider-payout";
  if (row.consignmentPayablePortion != null && row.consignmentPayablePortion > 0) return "consignment";
  if (row.sourceType === "FUND_TRANSFER" || row.sourceType === "INVESTMENT_TRANSACTION") return "transfer";
  return "generic";
}
