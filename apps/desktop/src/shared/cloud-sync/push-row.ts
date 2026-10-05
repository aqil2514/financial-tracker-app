/**
 * Baca 1 baris terbaru dari SQLite lokal lalu format jadi payload push
 * Worker -- dipakai `push-on-write.ts` (push langsung setelah tulis
 * sukses) DAN `push-queue.ts` (retry, baca ulang row terbaru, lihat
 * catatan desain di sana). Satu sumber kebenaran supaya kedua jalur
 * (push langsung vs retry) selalu kirim shape payload yang sama.
 */

import { getDb } from "@/lib/db";
import type { AccountType } from "@/lib/account-types";
import type { CloudSyncCredentials, PushUpsertResult } from "./worker-client";
import {
  pushAccount,
  pushAccountGroup,
  pushCategory,
  pushContact,
  pushTransaction,
  pushDebt,
  pushDebtPayment,
} from "./worker-client";
import type { QueueableTable } from "./push-queue";

export async function pushRowPayload(
  creds: CloudSyncCredentials,
  table: QueueableTable,
  id: string
): Promise<PushUpsertResult | null> {
  const db = await getDb();

  switch (table) {
    case "account_groups": {
      const rows = await db.select<
        { id: string; name: string; updated_at: string | null }[]
      >("SELECT id, name, updated_at FROM account_groups WHERE id = $1", [id]);
      const row = rows[0];
      if (!row) return null;
      return pushAccountGroup(creds, { id: row.id, name: row.name, updatedAt: row.updated_at ?? undefined });
    }
    case "categories": {
      const rows = await db.select<
        {
          id: string;
          name: string;
          icon: string | null;
          type: "income" | "expense";
          parent_id: string | null;
          is_active: number;
          updated_at: string | null;
        }[]
      >("SELECT id, name, icon, type, parent_id, is_active, updated_at FROM categories WHERE id = $1", [id]);
      const row = rows[0];
      if (!row) return null;
      return pushCategory(creds, {
        id: row.id,
        name: row.name,
        icon: row.icon,
        type: row.type,
        parentId: row.parent_id,
        isActive: !!row.is_active,
        updatedAt: row.updated_at ?? undefined,
      });
    }
    case "contacts": {
      const rows = await db.select<
        { id: string; name: string; note: string | null; updated_at: string | null }[]
      >("SELECT id, name, note, updated_at FROM contacts WHERE id = $1", [id]);
      const row = rows[0];
      if (!row) return null;
      return pushContact(creds, { id: row.id, name: row.name, note: row.note, updatedAt: row.updated_at ?? undefined });
    }
    case "accounts": {
      const rows = await db.select<
        {
          id: string;
          name: string;
          icon: string | null;
          color: string | null;
          initial_balance: number;
          group_id: string | null;
          description: string | null;
          is_active: number;
          account_type: AccountType;
          updated_at: string | null;
        }[]
      >(
        "SELECT id, name, icon, color, initial_balance, group_id, description, is_active, account_type, updated_at FROM accounts WHERE id = $1",
        [id]
      );
      const row = rows[0];
      if (!row) return null;
      return pushAccount(creds, {
        id: row.id,
        name: row.name,
        icon: row.icon,
        color: row.color,
        initialBalance: row.initial_balance,
        groupId: row.group_id,
        description: row.description,
        isActive: !!row.is_active,
        accountType: row.account_type,
        updatedAt: row.updated_at ?? undefined,
      });
    }
    case "transactions": {
      const rows = await db.select<
        {
          id: string;
          type: "income" | "expense" | "transfer";
          amount: number;
          category_id: string | null;
          account_id: string | null;
          transfer_account_id: string | null;
          note: string;
          description: string | null;
          date: string;
          contact_id: string | null;
          source: "manual" | "retailku_sync";
          source_ref: string | null;
          updated_at: string | null;
        }[]
      >(
        "SELECT id, type, amount, category_id, account_id, transfer_account_id, note, description, date, contact_id, source, source_ref, updated_at FROM transactions WHERE id = $1",
        [id]
      );
      const row = rows[0];
      if (!row) return null;
      return pushTransaction(creds, {
        id: row.id,
        type: row.type,
        amount: row.amount,
        categoryId: row.category_id,
        accountId: row.account_id,
        transferAccountId: row.transfer_account_id,
        note: row.note,
        description: row.description,
        date: row.date,
        contactId: row.contact_id,
        source: row.source,
        sourceRef: row.source_ref,
        updatedAt: row.updated_at ?? undefined,
      });
    }
    case "debts": {
      const rows = await db.select<
        {
          id: string;
          type: "receivable" | "payable";
          contact_id: string | null;
          amount: number;
          account_id: string | null;
          transaction_id: string | null;
          status: "ongoing" | "paid" | "written_off";
          note: string | null;
          date: string;
          source: "manual" | "retailku_sync";
          source_ref: string | null;
          updated_at: string | null;
        }[]
      >(
        "SELECT id, type, contact_id, amount, account_id, transaction_id, status, note, date, source, source_ref, updated_at FROM debts WHERE id = $1",
        [id]
      );
      const row = rows[0];
      if (!row) return null;
      // transaction_id null berarti baris belum ter-link ke transaksi
      // (gap terpisah, lihat dokumen rencana) -- push di-skip SEMENTARA,
      // endpoint Worker mewajibkan transactionId.
      if (!row.transaction_id) return null;
      return pushDebt(creds, {
        id: row.id,
        type: row.type,
        contactId: row.contact_id,
        amount: row.amount,
        accountId: row.account_id,
        transactionId: row.transaction_id,
        status: row.status,
        note: row.note,
        date: row.date,
        source: row.source,
        sourceRef: row.source_ref,
        updatedAt: row.updated_at ?? undefined,
      });
    }
    case "debt_payments": {
      const rows = await db.select<
        {
          id: string;
          debt_id: string;
          amount: number;
          account_id: string | null;
          transaction_id: string | null;
          note: string | null;
          date: string;
          source: "manual" | "retailku_sync";
          source_ref: string | null;
          updated_at: string | null;
        }[]
      >(
        "SELECT id, debt_id, amount, account_id, transaction_id, note, date, source, source_ref, updated_at FROM debt_payments WHERE id = $1",
        [id]
      );
      const row = rows[0];
      if (!row) return null;
      return pushDebtPayment(creds, {
        id: row.id,
        debtId: row.debt_id,
        amount: row.amount,
        accountId: row.account_id,
        transactionId: row.transaction_id,
        note: row.note,
        date: row.date,
        source: row.source,
        sourceRef: row.source_ref,
        updatedAt: row.updated_at ?? undefined,
      });
    }
  }
}
