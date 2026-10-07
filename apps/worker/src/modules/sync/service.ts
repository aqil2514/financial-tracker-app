import type { Env } from "../../shared/env";
import { nowText } from "../../shared/lww";
import type { AccountType } from "../../shared/account-types";

// Bentuk baris tiap tabel di response pull -- camelCase, KONSISTEN dgn
// payload endpoint tulis (lihat keputusan desain di
// docs/todos/plan/cloud-sync.md "Progress implementasi" bagian endpoint
// pull) supaya PC bisa reuse field yg sama kalau mau push ulang baris
// ini tanpa mapping manual snake_case<->camelCase.
export type SyncResponse = {
  checkpoint: string;
  accountGroups: Array<{ id: string; name: string; updatedAt: string | null; deletedAt: string | null }>;
  categories: Array<{
    id: string;
    name: string;
    icon: string | null;
    type: "income" | "expense";
    parentId: string | null;
    isActive: boolean;
    updatedAt: string | null;
    deletedAt: string | null;
  }>;
  contacts: Array<{
    id: string;
    name: string;
    note: string | null;
    updatedAt: string | null;
    deletedAt: string | null;
  }>;
  accounts: Array<{
    id: string;
    name: string;
    icon: string | null;
    initialBalance: number;
    groupId: string | null;
    description: string | null;
    isActive: boolean;
    accountType: AccountType;
    color: string | null;
    updatedAt: string | null;
    deletedAt: string | null;
  }>;
  transactions: Array<{
    id: string;
    type: "income" | "expense" | "transfer";
    amount: number;
    categoryId: string | null;
    accountId: string | null;
    transferAccountId: string | null;
    note: string;
    date: string;
    description: string | null;
    contactId: string | null;
    source: "manual" | "retailku_sync";
    sourceRef: string | null;
    updatedAt: string | null;
    deletedAt: string | null;
  }>;
  debts: Array<{
    id: string;
    type: "receivable" | "payable";
    contactId: string | null;
    amount: number;
    accountId: string | null;
    transactionId: string | null;
    status: "ongoing" | "paid" | "written_off";
    note: string | null;
    date: string;
    source: "manual" | "retailku_sync";
    sourceRef: string | null;
    updatedAt: string | null;
    deletedAt: string | null;
  }>;
  debtPayments: Array<{
    id: string;
    debtId: string;
    amount: number;
    accountId: string | null;
    transactionId: string | null;
    note: string | null;
    date: string;
    source: "manual" | "retailku_sync";
    sourceRef: string | null;
    updatedAt: string | null;
    deletedAt: string | null;
  }>;
  investmentAccounts: Array<{
    accountId: string;
    unitLabel: string;
    currentMarketValue: number;
    updatedAt: string | null;
    deletedAt: string | null;
  }>;
  investmentPurchases: Array<{
    id: string;
    accountId: string;
    transactionId: string | null;
    unit: number | null;
    pricePerUnit: number | null;
    date: string;
    status: "pending" | "settled";
    updatedAt: string | null;
    deletedAt: string | null;
  }>;
  investmentSales: Array<{
    id: string;
    accountId: string;
    transactionId: string | null;
    adjustmentTransactionId: string | null;
    unit: number;
    pricePerUnit: number;
    averageCostPerUnit: number | null;
    realizedPl: number | null;
    date: string;
    status: "pending" | "settled";
    updatedAt: string | null;
    deletedAt: string | null;
  }>;
};

// `since` null -> first sync, full snapshot SEMUA baris (termasuk yg
// deleted_at terisi -- PC WAJIB tau baris mana yg sudah dihapus di sisi
// lain, bukan cuma baris hidup). `since` terisi -> cuma baris yg
// `updated_at > since` (string-compare, lihat shared/lww.ts).
//
// `checkpoint` di response = waktu Worker MEMPROSES request ini (bukan
// `since` yg dikirim caller) -- PC simpan nilai ini sbg checkpoint utk
// pull BERIKUTNYA. Diambil SEBELUM query jalan (bukan sesudah) supaya
// baris yg berubah PAS SAAT query berjalan tetap tercakup di pull
// berikutnya (hindari celah "berubah tepat di antara query dan
// checkpoint diambil").
export async function getSyncSnapshot(env: Env, since: string | null): Promise<SyncResponse> {
  const checkpoint = nowText();
  const filter = since !== null ? "WHERE updated_at > ?1" : "";
  const bind = since !== null ? [since] : [];

  const [
    accountGroups,
    categories,
    contacts,
    accounts,
    transactions,
    debts,
    debtPayments,
    investmentAccounts,
    investmentPurchases,
    investmentSales,
  ] = await Promise.all([
    env.DB.prepare(`SELECT id, name, updated_at, deleted_at FROM account_groups ${filter}`)
      .bind(...bind)
      .all<{ id: string; name: string; updated_at: string | null; deleted_at: string | null }>(),
    env.DB.prepare(
      `SELECT id, name, icon, type, parent_id, is_active, updated_at, deleted_at FROM categories ${filter}`
    )
      .bind(...bind)
      .all<{
        id: string;
        name: string;
        icon: string | null;
        type: "income" | "expense";
        parent_id: string | null;
        is_active: number;
        updated_at: string | null;
        deleted_at: string | null;
      }>(),
    env.DB.prepare(`SELECT id, name, note, updated_at, deleted_at FROM contacts ${filter}`)
      .bind(...bind)
      .all<{ id: string; name: string; note: string | null; updated_at: string | null; deleted_at: string | null }>(),
    env.DB.prepare(
      `SELECT id, name, icon, initial_balance, group_id, description, is_active, account_type, color,
              updated_at, deleted_at
       FROM accounts ${filter}`
    )
      .bind(...bind)
      .all<{
        id: string;
        name: string;
        icon: string | null;
        initial_balance: number;
        group_id: string | null;
        description: string | null;
        is_active: number;
        account_type: AccountType;
        color: string | null;
        updated_at: string | null;
        deleted_at: string | null;
      }>(),
    env.DB.prepare(
      `SELECT id, type, amount, category_id, account_id, transfer_account_id, note, date, description,
              contact_id, source, source_ref, updated_at, deleted_at
       FROM transactions ${filter}`
    )
      .bind(...bind)
      .all<{
        id: string;
        type: "income" | "expense" | "transfer";
        amount: number;
        category_id: string | null;
        account_id: string | null;
        transfer_account_id: string | null;
        note: string;
        date: string;
        description: string | null;
        contact_id: string | null;
        source: "manual" | "retailku_sync";
        source_ref: string | null;
        updated_at: string | null;
        deleted_at: string | null;
      }>(),
    env.DB.prepare(
      `SELECT id, type, contact_id, amount, account_id, transaction_id, status, note, date,
              source, source_ref, updated_at, deleted_at
       FROM debts ${filter}`
    )
      .bind(...bind)
      .all<{
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
        deleted_at: string | null;
      }>(),
    env.DB.prepare(
      `SELECT id, debt_id, amount, account_id, transaction_id, note, date, source, source_ref, updated_at, deleted_at
       FROM debt_payments ${filter}`
    )
      .bind(...bind)
      .all<{
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
        deleted_at: string | null;
      }>(),
    env.DB.prepare(`SELECT account_id, unit_label, current_market_value, updated_at, deleted_at FROM investment_accounts ${filter}`)
      .bind(...bind)
      .all<{
        account_id: string;
        unit_label: string;
        current_market_value: number;
        updated_at: string | null;
        deleted_at: string | null;
      }>(),
    env.DB.prepare(
      `SELECT id, account_id, transaction_id, unit, price_per_unit, date, status, updated_at, deleted_at
       FROM investment_purchases ${filter}`
    )
      .bind(...bind)
      .all<{
        id: string;
        account_id: string;
        transaction_id: string | null;
        unit: number | null;
        price_per_unit: number | null;
        date: string;
        status: "pending" | "settled";
        updated_at: string | null;
        deleted_at: string | null;
      }>(),
    env.DB.prepare(
      `SELECT id, account_id, transaction_id, adjustment_transaction_id, unit, price_per_unit,
              average_cost_per_unit, realized_pl, date, status, updated_at, deleted_at
       FROM investment_sales ${filter}`
    )
      .bind(...bind)
      .all<{
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
        deleted_at: string | null;
      }>(),
  ]);

  return {
    checkpoint,
    accountGroups: accountGroups.results.map((r) => ({
      id: r.id,
      name: r.name,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
    })),
    categories: categories.results.map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      type: r.type,
      parentId: r.parent_id,
      isActive: r.is_active === 1,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
    })),
    contacts: contacts.results.map((r) => ({
      id: r.id,
      name: r.name,
      note: r.note,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
    })),
    accounts: accounts.results.map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      initialBalance: r.initial_balance,
      groupId: r.group_id,
      description: r.description,
      isActive: r.is_active === 1,
      accountType: r.account_type,
      color: r.color,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
    })),
    transactions: transactions.results.map((r) => ({
      id: r.id,
      type: r.type,
      amount: r.amount,
      categoryId: r.category_id,
      accountId: r.account_id,
      transferAccountId: r.transfer_account_id,
      note: r.note,
      date: r.date,
      description: r.description,
      contactId: r.contact_id,
      source: r.source,
      sourceRef: r.source_ref,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
    })),
    debts: debts.results.map((r) => ({
      id: r.id,
      type: r.type,
      contactId: r.contact_id,
      amount: r.amount,
      accountId: r.account_id,
      transactionId: r.transaction_id,
      status: r.status,
      note: r.note,
      date: r.date,
      source: r.source,
      sourceRef: r.source_ref,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
    })),
    debtPayments: debtPayments.results.map((r) => ({
      id: r.id,
      debtId: r.debt_id,
      amount: r.amount,
      accountId: r.account_id,
      transactionId: r.transaction_id,
      note: r.note,
      date: r.date,
      source: r.source,
      sourceRef: r.source_ref,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
    })),
    investmentAccounts: investmentAccounts.results.map((r) => ({
      accountId: r.account_id,
      unitLabel: r.unit_label,
      currentMarketValue: r.current_market_value,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
    })),
    investmentPurchases: investmentPurchases.results.map((r) => ({
      id: r.id,
      accountId: r.account_id,
      transactionId: r.transaction_id,
      unit: r.unit,
      pricePerUnit: r.price_per_unit,
      date: r.date,
      status: r.status,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
    })),
    investmentSales: investmentSales.results.map((r) => ({
      id: r.id,
      accountId: r.account_id,
      transactionId: r.transaction_id,
      adjustmentTransactionId: r.adjustment_transaction_id,
      unit: r.unit,
      pricePerUnit: r.price_per_unit,
      averageCostPerUnit: r.average_cost_per_unit,
      realizedPl: r.realized_pl,
      date: r.date,
      status: r.status,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
    })),
  };
}
