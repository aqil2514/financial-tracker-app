import { useEffect, useState } from "react";
import { useDatabase } from "@/lib/database";
import { getTransactionDebtStatus, remainingDebtSql, type TransactionDebtStatus } from "@/shared/debts";
import {
  computeDebtFieldsLocked,
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

// Hook ini cuma urusan fetch sourceInfo/destinationInfo/debtStatus/
// ongoingDebts dari DB — logic derivasinya (involvesDebtAccount,
// settlementDirection, validasi, locking) ada di derive-debt-fields.ts
// (pure, testable tanpa DB). transactionId diisi di mode EDIT saja —
// null/undefined di mode create berarti status selalu 'none' dan tidak
// ada exclude option di query ongoingDebts.
export function useTransactionDebtFields({
  type,
  accountId,
  transferAccountId,
  contactId,
  transactionId,
}: {
  type: "income" | "expense" | "transfer";
  accountId: string;
  transferAccountId: string | null;
  contactId: string | null;
  transactionId?: string;
}) {
  const db = useDatabase();
  const [sourceInfo, setSourceInfo] = useState<AccountDebtInfo | null>(null);
  const [destinationInfo, setDestinationInfo] = useState<AccountDebtInfo | null>(null);
  const [debtStatus, setDebtStatus] = useState<TransactionDebtStatus | null>(null);
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

  useEffect(() => {
    let cancelled = false;
    if (!transactionId) {
      setDebtStatus({ role: "none" });
      return;
    }
    getTransactionDebtStatus(db, transactionId).then((status) => {
      if (!cancelled) setDebtStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, [db, transactionId]);

  const derived = deriveDebtFields(type, sourceInfo, destinationInfo);
  const { settlementDirection } = derived;
  const debtFieldsLocked = computeDebtFieldsLocked(debtStatus);

  useEffect(() => {
    let cancelled = false;

    async function loadOngoingDebts() {
      if (!contactId || !settlementDirection) {
        if (!cancelled) setOngoingDebts([]);
        return;
      }

      // Filter normalnya status='ongoing' — TAPI kalau transaksi yang
      // sedang diedit sendiri role: 'payment' (excludeDebtId), debt yang
      // mungkin sudah 'paid' tetap disertakan (remaining dihitung TANPA
      // debt_payments milik transactionId itu sendiri, karena pembayaran
      // itu belum di-recreate saat form baru dibuka). role: 'principal'
      // (excludePrincipalDebtId) justru SEBALIKNYA — debt miliknya
      // sendiri harus DIKELUARKAN, karena baris itu akan dihapus oleh
      // proses edit yang sama sebelum FIFO sempat jalan.
      const excludeDebtId = debtStatus?.role === "payment" ? debtStatus.debtId : null;
      const excludeTransactionId = debtStatus?.role === "payment" ? transactionId ?? null : null;
      const excludePrincipalDebtId = debtStatus?.role === "principal" ? debtStatus.debtId : null;

      const rows = await db.getAllAsync<OngoingDebt>(
        `SELECT debts.id, debts.amount, debts.date,
                ${remainingDebtSql({ excludeTransactionIdParam: "?" })} AS remaining
         FROM debts
         WHERE debts.contact_id = ? AND debts.type = ?
           AND (debts.status = 'ongoing' OR debts.id = ?)
           AND (? IS NULL OR debts.id != ?)
         ORDER BY debts.date ASC, debts.id ASC`,
        [
          // 2x untuk "? IS NULL OR ... IS NOT ?" di remainingDebtSql
          excludeTransactionId,
          excludeTransactionId,
          contactId,
          settlementDirection,
          excludeDebtId,
          excludePrincipalDebtId,
          excludePrincipalDebtId,
        ]
      );
      if (!cancelled) setOngoingDebts(rows);
    }

    loadOngoingDebts();
    return () => {
      cancelled = true;
    };
  }, [db, contactId, settlementDirection, debtStatus, transactionId]);

  function validateDebtFields(values: { amount: number; contact_id: string | null; settle_debt_ids: string[] }) {
    return validateDebtFieldsPure(derived, ongoingDebts, values, debtFieldsLocked);
  }

  return {
    involvesDebtAccount: derived.involvesDebtAccount,
    needsDebtAction: derived.needsDebtAction,
    settlementDirection: derived.settlementDirection,
    ongoingDebts,
    isDebtDebtTransfer: derived.isDebtDebtTransfer,
    debtStatus,
    debtFieldsLocked,
    validateDebtFields,
  };
}
