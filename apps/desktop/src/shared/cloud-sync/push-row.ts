/**
 * Baca 1 baris terbaru dari SQLite lokal lalu format jadi payload push
 * Worker -- dipakai `push-on-write.ts` (push langsung setelah tulis
 * sukses) DAN `push-queue.ts` (retry, baca ulang row terbaru, lihat
 * catatan desain di sana). Satu sumber kebenaran supaya kedua jalur
 * (push langsung vs retry) selalu kirim shape payload yang sama.
 */

import { invoke } from "@tauri-apps/api/core";

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
  pushInvestmentAccount,
  pushInvestmentPurchase,
  pushInvestmentSale,
  pushAttachment,
  pushLabel,
  pushAttachLabel,
  type LabelEntityScope,
} from "./worker-client";
import type { QueueableTable } from "./push-queue";

// `transaction_attachments` lokal TIDAK py kolom `content_type` (skema
// SENGAJA tidak berubah, lihat attachment-r2-sync.md) -- infer dari
// ekstensi file utk dikirim ke Worker (dipakai Worker utk header
// Content-Type saat serve & cari ekstensi `r2_key`). Daftar minimal
// format foto struk yang realistis dipakai; selain itu fallback null
// (Worker treat sbg "bin").
const EXTENSION_CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
};

function inferContentType(filePath: string): string | null {
  const ext = filePath.split(".").pop()?.toLowerCase();
  return ext ? (EXTENSION_CONTENT_TYPE[ext] ?? null) : null;
}

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
    case "investment_accounts": {
      const rows = await db.select<
        { account_id: string; unit_label: string; current_market_value: number; updated_at: string | null }[]
      >(
        "SELECT account_id, unit_label, current_market_value, updated_at FROM investment_accounts WHERE account_id = $1",
        [id]
      );
      const row = rows[0];
      if (!row) return null;
      return pushInvestmentAccount(creds, {
        accountId: row.account_id,
        unitLabel: row.unit_label,
        currentMarketValue: row.current_market_value,
        updatedAt: row.updated_at ?? undefined,
      });
    }
    case "investment_purchases": {
      const rows = await db.select<
        {
          id: string;
          account_id: string;
          transaction_id: string | null;
          unit: number | null;
          price_per_unit: number | null;
          date: string;
          status: "pending" | "settled";
          updated_at: string | null;
        }[]
      >(
        "SELECT id, account_id, transaction_id, unit, price_per_unit, date, status, updated_at FROM investment_purchases WHERE id = $1",
        [id]
      );
      const row = rows[0];
      if (!row) return null;
      // transaction_id null berarti baris belum ter-link ke transaksi --
      // push di-skip SEMENTARA, sama pola dgn "debts" di atas (endpoint
      // Worker mewajibkan transactionId). Beda dari investment_sales di
      // bawah yang MEMANG boleh null selama status pending.
      if (!row.transaction_id) return null;
      return pushInvestmentPurchase(creds, {
        id: row.id,
        accountId: row.account_id,
        transactionId: row.transaction_id,
        unit: row.unit,
        pricePerUnit: row.price_per_unit,
        date: row.date,
        status: row.status,
        updatedAt: row.updated_at ?? undefined,
      });
    }
    case "investment_sales": {
      const rows = await db.select<
        {
          id: string;
          account_id: string;
          transaction_id: string | null;
          adjustment_transaction_id: string | null;
          unit: number;
          price_per_unit: number;
          average_cost_per_unit: number | null;
          realized_pl: number | null;
          date: string;
          status: "pending" | "settled";
          updated_at: string | null;
        }[]
      >(
        "SELECT id, account_id, transaction_id, adjustment_transaction_id, unit, price_per_unit, average_cost_per_unit, realized_pl, date, status, updated_at FROM investment_sales WHERE id = $1",
        [id]
      );
      const row = rows[0];
      if (!row) return null;
      return pushInvestmentSale(creds, {
        id: row.id,
        accountId: row.account_id,
        transactionId: row.transaction_id,
        adjustmentTransactionId: row.adjustment_transaction_id,
        unit: row.unit,
        pricePerUnit: row.price_per_unit,
        averageCostPerUnit: row.average_cost_per_unit,
        realizedPl: row.realized_pl,
        date: row.date,
        status: row.status,
        updatedAt: row.updated_at ?? undefined,
      });
    }
    case "transaction_attachments": {
      // Skema lokal TIDAK py `updated_at` (`id, transaction_id, file_path,
      // created_at` saja, lihat attachment-r2-sync.md) -- `updatedAt` TIDAK
      // dikirim, Worker pakai now() sendiri (SELALU menang, konsisten dgn
      // field opsional di shared/lww.ts Worker -- attachment TIDAK pernah
      // di-edit setelah dibuat, cuma dibuat/dihapus, jadi tidak ada risiko
      // menimpa perubahan lain yang lebih baru).
      const rows = await db.select<{ id: string; transaction_id: string; file_path: string }[]>(
        "SELECT id, transaction_id, file_path FROM transaction_attachments WHERE id = $1",
        [id]
      );
      const row = rows[0];
      if (!row) return null;
      const bytes = await invoke<number[]>("read_attachment_bytes", { filePath: row.file_path });
      return pushAttachment(creds, {
        id: row.id,
        transactionId: row.transaction_id,
        bytes: Uint8Array.from(bytes),
        contentType: inferContentType(row.file_path),
      });
    }
    case "labels": {
      const rows = await db.select<
        { id: string; name: string; scope: "transaction_category" | "account"; updated_at: string | null }[]
      >("SELECT id, name, scope, updated_at FROM labels WHERE id = $1", [id]);
      const row = rows[0];
      if (!row) return null;
      return pushLabel(creds, { id: row.id, name: row.name, scope: row.scope, updatedAt: row.updated_at ?? undefined });
    }
    // 3 junction table attach label -- SAMA bentuk query/push, cuma beda
    // nama tabel/kolom FK (lihat JUNCTION di
    // apps/worker/src/modules/labels/service.ts, pola identik di sini).
    case "transaction_labels":
    case "category_labels":
    case "account_labels": {
      const junction: Record<
        "transaction_labels" | "category_labels" | "account_labels",
        { column: string; scope: LabelEntityScope }
      > = {
        transaction_labels: { column: "transaction_id", scope: "transactions" },
        category_labels: { column: "category_id", scope: "categories" },
        account_labels: { column: "account_id", scope: "accounts" },
      };
      const { column, scope } = junction[table];
      const rows = await db.select<
        { id: string; entity_id: string; label_id: string; updated_at: string | null }[]
      >(`SELECT id, ${column} as entity_id, label_id, updated_at FROM ${table} WHERE id = $1`, [id]);
      const row = rows[0];
      if (!row) return null;
      return pushAttachLabel(creds, scope, row.entity_id, {
        id: row.id,
        labelId: row.label_id,
        updatedAt: row.updated_at ?? undefined,
      });
    }
  }
}
