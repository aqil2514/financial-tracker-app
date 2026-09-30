export type CorrectAccountBalancePayload = {
  accountId: string;
  targetBalance: number;
};

export function isCorrectAccountBalancePayload(
  value: unknown
): value is CorrectAccountBalancePayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.accountId === "string" && typeof v.targetBalance === "number";
}
