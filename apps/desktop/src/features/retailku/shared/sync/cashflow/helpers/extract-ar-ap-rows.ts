import type { getCashflowDetail } from "@/shared/retailku";

export type ArApCashAccount = {
  accountId: string;
  accountCode: string;
  accountName: string;
  amount: number;
};

export type ArApRow = {
  journalItemId: string;
  date: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  sourceType: string | null;
  direction: "receivable" | "payable";
  partyId: string | null;
  partyName: string | null;
  kind: "trade" | "non-trade" | null;
  cashAccounts: ArApCashAccount[];
  amount: number;
  sourceRef: string;
  isReversed: boolean;
  /** ID journal item piutang ASLI yang dilunasi baris pelunasan ini —
   * cuma terisi kalau baris INI SENDIRI adalah baris piutang (akun
   * TRADE_RECEIVABLE) dari journal entry SALE_PAYMENT (BEDA dari
   * journal entry SALE aslinya, tapi sourceType-nya SAMA-SAMA piutang
   * dagang) — server resolve field ini ke journal item piutang di
   * journal SALE aslinya, dipakai mencari `debts` yang harus dicicil
   * lewat source_ref. `null` untuk baris piutang BARU (bukan
   * pelunasan) dan untuk kasus pelunasan selain SALE_PAYMENT (belum
   * didukung). */
  settledReceivablePayableJournalItemId: string | null;
};

export function buildArApMappingKey(accountId: string, direction: "receivable" | "payable"): string {
  return `ar_ap:${accountId}:${direction}`;
}

export function extractArApRows(
  rows: Awaited<ReturnType<typeof getCashflowDetail>>["data"]
): ArApRow[] {
  return rows
    .filter((row) => row.isReceivablePayableAccount && row.receivablePayableDirection != null)
    .map((row) => {
      const direction = row.receivablePayableDirection as "receivable" | "payable";
      const amount = direction === "receivable" ? row.debit - row.credit : row.credit - row.debit;
      return {
        journalItemId: row.id,
        date: row.date.slice(0, 10),
        accountId: row.accountId,
        accountCode: row.accountCode,
        accountName: row.accountName,
        sourceType: row.sourceType,
        partyId: row.partyId,
        partyName: row.partyName,
        kind: row.receivablePayableKind,
        cashAccounts: row.cashAccounts,
        direction,
        amount,
        sourceRef: `${row.id}:ar_ap`,
        isReversed: row.isReversed,
        settledReceivablePayableJournalItemId: row.settledReceivablePayableJournalItemId,
      };
    });
}
