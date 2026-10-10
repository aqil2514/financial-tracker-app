export function wins(incomingUpdatedAt: string | null, localUpdatedAt: string | null): boolean {
  if (incomingUpdatedAt === null) return false;
  if (localUpdatedAt === null) return true;
  return incomingUpdatedAt > localUpdatedAt;
}
