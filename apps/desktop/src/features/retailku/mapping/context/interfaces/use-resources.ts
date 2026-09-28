// apps\desktop\src\features\retailku\mapping\context\hooks\use-resources.ts

import { AccountWithBalance } from "@/hooks/resources";
import { Category, Contact } from "@/lib/db";

export interface UseResourcesOutput {
  localAccountOptions: AccountWithBalance[]
  /** Akun `account_type === "debt"` aktif — dipakai form mapping AR_AP
   * (`localAccountId` di sana berarti akun UTANG/PIUTANG, BUKAN akun
   * kas seperti `localAccountOptions`). BEDA dari `localAccountOptions`
   * yang sengaja difilter cash saja (dipakai generic/transfer). */
  debtAccountOptions: AccountWithBalance[];
  categoryOptions: Category[];
  /** Dipakai form mapping AR_AP (`contactId`) — kontak lokal tujuan
   * piutang/utang, lihat `ArApMappingRowDraft`. */
  contactOptions: Contact[];
}
