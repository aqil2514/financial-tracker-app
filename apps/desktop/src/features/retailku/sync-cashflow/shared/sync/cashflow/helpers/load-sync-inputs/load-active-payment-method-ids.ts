import { getFinanceAccounts, type connectRetailkuMcp } from "@/shared/retailku";

/** `id` akun Retailku yang SAAT INI `isPaymentMethod: true` — dipakai
 * validasi point-of-use, lihat dokumentasi lengkap di
 * `computeCashflowSync`. */
export async function loadActivePaymentMethodIds(
  client: Awaited<ReturnType<typeof connectRetailkuMcp>>
): Promise<Set<string>> {
  const accounts = await getFinanceAccounts(client);
  return new Set(accounts.filter((account) => account.isPaymentMethod).map((account) => account.id));
}
