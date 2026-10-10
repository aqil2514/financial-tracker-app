import { hasLocalRow } from "./has-local-row";

export async function hasLocalTransaction(transactionId: string): Promise<boolean> {
  return hasLocalRow("transactions", transactionId);
}
