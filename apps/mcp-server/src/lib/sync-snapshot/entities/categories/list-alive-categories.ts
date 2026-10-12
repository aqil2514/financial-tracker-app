import { isAlive } from "../../shared";
import type { Category, SyncSnapshot } from "../../types";

export function listAliveCategories(snapshot: SyncSnapshot): Category[] {
  return snapshot.categories.filter(isAlive);
}
