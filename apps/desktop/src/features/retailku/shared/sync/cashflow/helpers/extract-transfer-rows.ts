import type { getFundTransferList } from "@/shared/retailku/mcp-tools";

export type TransferRow = {
  key: string;
  transferId: string;
  transferNumber: string;
  date: string;
  fromAccountId: string;
  fromAccountCode: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountCode: string;
  toAccountName: string;
  amount: number;
  sourceRef: string;
};

export function extractTransferRows(
  items: Awaited<ReturnType<typeof getFundTransferList>>["data"]
): TransferRow[] {
  return items
    .filter((item) => item.status === "POSTED")
    .map((item) => ({
      key: `transfer:${item.fromAccount.id}:${item.toAccount.id}`,
      transferId: item.id,
      transferNumber: item.number,
      date: item.transactionDate.slice(0, 10),
      fromAccountId: item.fromAccount.id,
      fromAccountCode: item.fromAccount.code,
      fromAccountName: item.fromAccount.name,
      toAccountId: item.toAccount.id,
      toAccountCode: item.toAccount.code,
      toAccountName: item.toAccount.name,
      amount: item.transferAmount,
      sourceRef: `${item.id}:transfer`,
    }));
}
