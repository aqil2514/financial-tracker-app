import { isAlive } from "../../shared";
import type { Account, SyncSnapshot } from "../../types";

export function listAliveAccounts(snapshot: SyncSnapshot): Account[] {
  return snapshot.accounts.filter(isAlive);
}
