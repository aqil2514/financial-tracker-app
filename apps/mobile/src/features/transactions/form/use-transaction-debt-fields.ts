import { useEffect, useState } from "react";
import { useDatabase } from "@/lib/database";
import { remainingDebtSql } from "@/shared/debts";
import {
  deriveDebtFields,
  validateDebtFields as validateDebtFieldsPure,
  type AccountDebtInfo,
  type OngoingDebt,
} from "./derive-debt-fields";

export type { OngoingDebt };

async function loadAccountDebtInfo(
  db: ReturnType<typeof useDatabase>,
  accountId: string | null
): Promise<AccountDebtInfo | null> {
  if (!accountId) return null;
  const row = await db.getFirstAsync<{ account_type: "cash" | "debt"; direction: "receivable" | "payable" | null }>(
    `SELECT accounts.account_type, debt_accounts.direction FROM accounts
     LEFT JOIN debt_accounts ON debt_accounts.account_id = accounts.id
     WHERE accounts.id = ?`,
    [accountId]
  );
  if (!row) return null;
  return { accountType: row.account_type, direction: row.direction };
}

// Hook ini cuma urusan fetch sourceInfo/destinationInfo/ongoingDebts
// dari DB — logic derivasinya (involvesDebtAccount, settlementDirection,
// validasi) ada di derive-debt-fields.ts (pure, testable tanpa DB).
export function useTransactionDebtFields({
  type,
  accountId,
  transferAccountId,
  contactId,
}: {
  type: "income" | "expense" | "transfer";
  accountId: string;
  transferAccountId: string | null;
  contactId: string | null;
}) {
  const db = useDatabase();
  const [sourceInfo, setSourceInfo] = useState<AccountDebtInfo | null>(null);
  const [destinationInfo, setDestinationInfo] = useState<AccountDebtInfo | null>(null);
  const [ongoingDebts, setOngoingDebts] = useState<OngoingDebt[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadAccountDebtInfo(db, accountId || null),
      loadAccountDebtInfo(db, transferAccountId),
    ]).then(([source, destination]) => {
      if (!cancelled) {
        setSourceInfo(source);
        setDestinationInfo(destination);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [db, accountId, transferAccountId]);

  const derived = deriveDebtFields(type, sourceInfo, destinationInfo);
  const { settlementDirection } = derived;

  useEffect(() => {
    let cancelled = false;

    async function loadOngoingDebts() {
      if (!contactId || !settlementDirection) {
        if (!cancelled) setOngoingDebts([]);
        return;
      }
      const rows = await db.getAllAsync<OngoingDebt>(
        `SELECT debts.id, debts.amount, debts.date, ${remainingDebtSql()} AS remaining
         FROM debts
         WHERE debts.contact_id = ? AND debts.type = ? AND debts.status = 'ongoing'
         ORDER BY debts.date ASC, debts.id ASC`,
        [contactId, settlementDirection]
      );
      if (!cancelled) setOngoingDebts(rows);
    }

    loadOngoingDebts();
    return () => {
      cancelled = true;
    };
  }, [db, contactId, settlementDirection]);

  function validateDebtFields(values: { amount: number; contact_id: string | null; settle_debt_ids: string[] }) {
    return validateDebtFieldsPure(derived, ongoingDebts, values);
  }

  return {
    involvesDebtAccount: derived.involvesDebtAccount,
    needsDebtAction: derived.needsDebtAction,
    settlementDirection: derived.settlementDirection,
    ongoingDebts,
    isDebtDebtTransfer: derived.isDebtDebtTransfer,
    validateDebtFields,
  };
}
