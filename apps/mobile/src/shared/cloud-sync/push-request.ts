import type { SQLiteDatabase } from "expo-sqlite";
import type { PushRequest, PushTable } from "./types";

// transaction_attachments dikirim multipart (file biner) lewat AttachmentTransport, bukan JSON.
export type JsonPushTable = Exclude<PushTable, "transaction_attachments">;

// Junction label: tabel -> kolom entitas dan segmen `:scope` di path Worker (`labels.scope` BEDA, jangan tertukar).
export const LABEL_JUNCTIONS = {
  transaction_labels: { column: "transaction_id", scope: "transactions" },
  category_labels: { column: "category_id", scope: "categories" },
  account_labels: { column: "account_id", scope: "accounts" },
} as const;

export type LabelJunctionTable = keyof typeof LABEL_JUNCTIONS;

export function isLabelJunction(table: string): table is LabelJunctionTable {
  return table in LABEL_JUNCTIONS;
}

export function labelJunctionDeletePath(table: LabelJunctionTable, payload: string | null): string | null {
  const parsed = payload ? (JSON.parse(payload) as { entityId?: string; labelId?: string }) : null;
  if (!parsed?.entityId || !parsed.labelId) return null;
  return `/labels/${LABEL_JUNCTIONS[table].scope}/${encodeURIComponent(parsed.entityId)}/${encodeURIComponent(parsed.labelId)}`;
}

function junctionBuilder(table: LabelJunctionTable) {
  const { column, scope } = LABEL_JUNCTIONS[table];
  return async (db: SQLiteDatabase, id: string): Promise<PushRequest | null> => {
    const row = await selectOne(db, `SELECT id, ${column} AS entity_id, label_id, updated_at FROM ${table} WHERE id = ?`, id);
    return (
      row && {
        path: `/labels/${scope}/${encodeURIComponent(String(row.entity_id))}`,
        body: { id: row.id, labelId: row.label_id, updatedAt: updatedAt(row) },
      }
    );
  };
}

// Satu-satunya tempat bentuk payload push didefinisikan di mobile; salinan kontrak desktop
// (apps/desktop/src/shared/cloud-sync/worker-client/push-*.ts). Mengembalikan null kalau baris sudah
// tidak ada atau belum boleh dikirim (Worker mewajibkan transactionId untuk debts/purchases).
type Row = Record<string, string | number | null>;

async function selectOne(db: SQLiteDatabase, sql: string, id: string): Promise<Row | null> {
  return (await db.getFirstAsync<Row>(sql, [id])) ?? null;
}

const updatedAt = (row: Row) => row.updated_at ?? undefined;

const BUILDERS: Record<JsonPushTable, (db: SQLiteDatabase, id: string) => Promise<PushRequest | null>> = {
  account_groups: async (db, id) => {
    const row = await selectOne(db, "SELECT id, name, updated_at FROM account_groups WHERE id = ?", id);
    return row && { path: "/account-groups", body: { id: row.id, name: row.name, updatedAt: updatedAt(row) } };
  },

  categories: async (db, id) => {
    const row = await selectOne(
      db,
      "SELECT id, name, icon, type, parent_id, is_active, updated_at FROM categories WHERE id = ?",
      id
    );
    return (
      row && {
        path: "/categories",
        body: {
          id: row.id,
          name: row.name,
          icon: row.icon,
          type: row.type,
          parentId: row.parent_id,
          isActive: row.is_active === 1,
          updatedAt: updatedAt(row),
        },
      }
    );
  },

  contacts: async (db, id) => {
    const row = await selectOne(db, "SELECT id, name, note, updated_at FROM contacts WHERE id = ?", id);
    return (
      row && { path: "/contacts", body: { id: row.id, name: row.name, note: row.note, updatedAt: updatedAt(row) } }
    );
  },

  labels: async (db, id) => {
    const row = await selectOne(db, "SELECT id, name, scope, updated_at FROM labels WHERE id = ?", id);
    return (
      row && {
        path: "/labels",
        body: { id: row.id, name: row.name, scope: row.scope, updatedAt: updatedAt(row) },
      }
    );
  },

  transaction_labels: junctionBuilder("transaction_labels"),
  category_labels: junctionBuilder("category_labels"),
  account_labels: junctionBuilder("account_labels"),

  accounts: async (db, id) => {
    const row = await selectOne(
      db,
      `SELECT id, name, icon, color, initial_balance, group_id, description, is_active, account_type, updated_at
       FROM accounts WHERE id = ?`,
      id
    );
    if (!row) return null;

    let direction: string | null | undefined;
    if (row.account_type === "debt") {
      const debtAccount = await db.getFirstAsync<{ direction: string }>(
        "SELECT direction FROM debt_accounts WHERE account_id = ?",
        [id]
      );
      direction = debtAccount?.direction ?? null;
    }

    return {
      path: "/accounts",
      body: {
        id: row.id,
        name: row.name,
        icon: row.icon,
        color: row.color,
        initialBalance: row.initial_balance,
        groupId: row.group_id,
        description: row.description,
        isActive: row.is_active === 1,
        accountType: row.account_type,
        updatedAt: updatedAt(row),
        direction,
      },
    };
  },

  category_periods: async (db, id) => {
    const row = await selectOne(
      db,
      "SELECT id, name, start_date, end_date, updated_at FROM category_periods WHERE id = ?",
      id
    );
    if (!row) return null;
    const pivots = await db.getAllAsync<{ id: string; category_id: string }>(
      "SELECT id, category_id FROM category_period_categories WHERE period_id = ?",
      [id]
    );
    return {
      path: "/category-periods/push",
      body: {
        id: row.id,
        name: row.name,
        startDate: row.start_date,
        endDate: row.end_date,
        categoryIds: pivots.map((pivot) => ({ id: pivot.id, categoryId: pivot.category_id })),
        updatedAt: updatedAt(row),
      },
    };
  },

  transactions: async (db, id) => {
    const row = await selectOne(
      db,
      `SELECT id, type, amount, category_id, account_id, transfer_account_id, note, description, date,
              contact_id, is_cash_neutral, updated_at
       FROM transactions WHERE id = ?`,
      id
    );
    return (
      row && {
        path: "/transactions",
        body: {
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
          updatedAt: updatedAt(row),
          isCashNeutral: row.is_cash_neutral === 1,
        },
      }
    );
  },

  debts: async (db, id) => {
    const row = await selectOne(
      db,
      `SELECT id, type, contact_id, amount, account_id, transaction_id, status, note, date, updated_at
       FROM debts WHERE id = ?`,
      id
    );
    if (!row || !row.transaction_id) return null;
    return {
      path: "/debts/push",
      body: {
        id: row.id,
        type: row.type,
        contactId: row.contact_id,
        amount: row.amount,
        accountId: row.account_id,
        transactionId: row.transaction_id,
        status: row.status,
        note: row.note,
        date: row.date,
        updatedAt: updatedAt(row),
      },
    };
  },

  debt_payments: async (db, id) => {
    const row = await selectOne(
      db,
      "SELECT id, debt_id, amount, account_id, transaction_id, note, date, updated_at FROM debt_payments WHERE id = ?",
      id
    );
    return (
      row && {
        path: "/debts/payments/push",
        body: {
          id: row.id,
          debtId: row.debt_id,
          amount: row.amount,
          accountId: row.account_id,
          transactionId: row.transaction_id,
          note: row.note,
          date: row.date,
          updatedAt: updatedAt(row),
        },
      }
    );
  },

  investment_accounts: async (db, id) => {
    const row = await selectOne(
      db,
      "SELECT account_id, unit_label, current_market_value, updated_at FROM investment_accounts WHERE account_id = ?",
      id
    );
    return (
      row && {
        path: "/investments/accounts/push",
        body: {
          accountId: row.account_id,
          unitLabel: row.unit_label,
          currentMarketValue: row.current_market_value,
          updatedAt: updatedAt(row),
        },
      }
    );
  },

  investment_purchases: async (db, id) => {
    const row = await selectOne(
      db,
      `SELECT id, account_id, transaction_id, unit, price_per_unit, date, status, updated_at
       FROM investment_purchases WHERE id = ?`,
      id
    );
    if (!row || !row.transaction_id) return null;
    return {
      path: "/investments/purchases/push",
      body: {
        id: row.id,
        accountId: row.account_id,
        transactionId: row.transaction_id,
        unit: row.unit,
        pricePerUnit: row.price_per_unit,
        date: row.date,
        status: row.status,
        updatedAt: updatedAt(row),
      },
    };
  },

  investment_sales: async (db, id) => {
    const row = await selectOne(
      db,
      `SELECT id, account_id, transaction_id, adjustment_transaction_id, unit, price_per_unit,
              average_cost_per_unit, realized_pl, date, status, updated_at
       FROM investment_sales WHERE id = ?`,
      id
    );
    return (
      row && {
        path: "/investments/sales/push",
        body: {
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
          updatedAt: updatedAt(row),
        },
      }
    );
  },

  third_party_funds: async (db, id) => {
    const row = await selectOne(
      db,
      `SELECT id, account_id, contact_id, transaction_id, direction, amount, date, note, updated_at
       FROM third_party_funds WHERE id = ?`,
      id
    );
    return (
      row && {
        path: "/third-party-funds/push",
        body: {
          id: row.id,
          accountId: row.account_id,
          contactId: row.contact_id,
          transactionId: row.transaction_id,
          direction: row.direction,
          amount: row.amount,
          date: row.date,
          note: row.note,
          updatedAt: updatedAt(row),
        },
      }
    );
  },
};

export function buildPushRequest(db: SQLiteDatabase, table: JsonPushTable, id: string): Promise<PushRequest | null> {
  return BUILDERS[table](db, id);
}

// Path DELETE per tabel (id ditambahkan di belakang). investment_accounts tidak punya endpoint delete.
export const DELETE_PATH: Record<Exclude<PushTable, "investment_accounts" | LabelJunctionTable>, string> = {
  transaction_attachments: "/attachments",
  account_groups: "/account-groups",
  categories: "/categories",
  contacts: "/contacts",
  labels: "/labels",
  accounts: "/accounts",
  category_periods: "/category-periods/push",
  transactions: "/transactions",
  debts: "/debts/push",
  debt_payments: "/debts/payments/push",
  investment_purchases: "/investments/purchases/push",
  investment_sales: "/investments/sales/push",
  third_party_funds: "/third-party-funds/push",
};
