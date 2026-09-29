import type { CashflowSyncPlanRow } from "../../types";
import type { resolveMappedTotal } from "./resolve-mapped-total";

/** Mapping-nya ADA, tapi akun Retailku yang dirujuk sudah dinonaktifkan
 * sebagai payment method sejak di-mapping — validasi point-of-use,
 * lihat dokumentasi `computeCashflowSync`. */
export function deactivatedPaymentMethodPlanRow(
  resolved: ReturnType<typeof resolveMappedTotal>,
  localAccountId: string
): CashflowSyncPlanRow {
  return {
    ...resolved,
    willInsert: false,
    skipReason: "deactivated-payment-method",
    localAccountId,
  };
}
