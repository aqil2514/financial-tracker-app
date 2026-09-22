import type { AccountWithBalance } from "@/features/accounts";

/**
 * Nama akun untuk ditampilkan, menyertakan grup kalau ada — beberapa
 * akun berbeda memakai nama yang sama persis (mis. "BRI" di grup
 * "Sea Bank" vs "Bank Lainnya"), tanpa grup keduanya tidak bisa
 * dibedakan sama sekali di UI. Dipakai baik oleh list transaksi maupun
 * dialog detail transaksi — lihat page-layout.md "Folder shared/".
 */
export function accountName(
  accounts: AccountWithBalance[] | undefined,
  id: number | null
): string {
  const account = accounts?.find((account) => account.id === id);
  if (!account) return "-";
  return account.group_name ? `${account.name} — ${account.group_name}` : account.name;
}
