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
      };
    });
}
