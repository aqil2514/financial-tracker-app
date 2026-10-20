import { useState } from "react";
import { getDb } from "@/lib/db";
import { checkBalanceConsistency, type OrphanTransaction } from "./check-balance-consistency";

export function useCheckBalanceConsistency() {
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<OrphanTransaction[] | null>(null);

  async function run() {
    setIsPending(true);
    try {
      const db = await getDb();
      const orphans = await checkBalanceConsistency(db);
      setResult(orphans);
    } finally {
      setIsPending(false);
    }
  }

  function reset() {
    setResult(null);
  }

  return { run, reset, result, isPending };
}
