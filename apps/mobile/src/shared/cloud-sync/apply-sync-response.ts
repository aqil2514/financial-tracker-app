import type { SQLiteDatabase } from "expo-sqlite";
import { generateId } from "@/lib/database/generate-id";
import type { SyncResponse } from "./pull-types";

type Value = string | number | null;

type Spec<TRow> = {
  table: string;
  key: "id" | "account_id";
  rows: TRow[];
  keyOf: (row: TRow) => string;
  updatedAtOf: (row: TRow) => string | null;
  deletedAtOf: (row: TRow) => string | null;
  columns: (row: TRow) => Record<string, Value>;
  // Tabel yang menyimpan baris anak di payload induknya (pivot periode kategori).
  afterUpsert?: (db: SQLiteDatabase, row: TRow) => Promise<void>;
  beforeUpsert?: (db: SQLiteDatabase, row: TRow) => Promise<void>;
};

// rejected = gagal sementara (menahan checkpoint); skipped = gagal permanen yang dicatat tapi tidak menahan checkpoint.
export type ApplyResult = { applied: number; rejected: number; skipped: number };
type ApplyOptions = { fullSnapshot: boolean };

// Kegagalan yang tidak akan pernah berhasil, jadi tidak boleh menahan checkpoint selamanya:
// - transaksi tanpa account_id: kolom itu NOT NULL di mobile, sedangkan cloud mengizinkan kosong.
// - FK gagal pada pull PENUH: semua induk yang masih ada ikut terkirim, jadi induk yang tidak ada memang sudah
//   dihapus (mis. anak dari akun yang di-soft-delete di cloud). Pada pull inkremental FK gagal bisa berarti induk
//   lebih lama dari checkpoint, jadi tetap menahan checkpoint.
function isPermanentFailure(error: unknown, options: ApplyOptions): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (/NOT NULL constraint failed: transactions\.account_id/.test(message)) return true;
  return options.fullSnapshot && /FOREIGN KEY constraint failed/.test(message);
}

// LWW: menang hanya kalau STRICT lebih baru (sama dengan apps/worker/src/shared/lww.ts).
function wins(incoming: string | null, local: string | null): boolean {
  if (incoming === null) return false;
  if (local === null) return true;
  return incoming > local;
}

async function upsertRow<TRow>(db: SQLiteDatabase, spec: Spec<TRow>, row: TRow) {
  await spec.beforeUpsert?.(db, row);
  const columns = { [spec.key]: spec.keyOf(row), ...spec.columns(row), updated_at: spec.updatedAtOf(row) };
  const names = Object.keys(columns);
  const updates = names.filter((name) => name !== spec.key).map((name) => `${name} = excluded.${name}`);
  await db.runAsync(
    `INSERT INTO ${spec.table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})
     ON CONFLICT (${spec.key}) DO UPDATE SET ${updates.join(", ")}`,
    Object.values(columns)
  );
  await spec.afterUpsert?.(db, row);
}

async function logRejected(db: SQLiteDatabase, table: string, rowId: string, error: unknown) {
  await db.runAsync(
    `INSERT INTO cloud_sync_rejected_log (table_name, row_id, direction, reason) VALUES (?, ?, 'pull', ?)
     ON CONFLICT (table_name, row_id, direction) DO UPDATE SET reason = excluded.reason, rejected_at = datetime('now')`,
    [table, rowId, error instanceof Error ? error.message : String(error)]
  );
}

async function clearRejected(db: SQLiteDatabase, table: string, rowId: string) {
  await db.runAsync("DELETE FROM cloud_sync_rejected_log WHERE table_name = ? AND row_id = ? AND direction = 'pull'", [
    table,
    rowId,
  ]);
}

// Satu baris: LWW, lalu hard delete (deletedAt terisi) atau upsert. Melempar kalau SQLite menolak (FK, NOT NULL).
async function applyOne<TRow>(db: SQLiteDatabase, spec: Spec<TRow>, row: TRow): Promise<boolean> {
  const local = await db.getFirstAsync<{ updated_at: string | null }>(
    `SELECT updated_at FROM ${spec.table} WHERE ${spec.key} = ?`,
    [spec.keyOf(row)]
  );
  if (!wins(spec.updatedAtOf(row), local?.updated_at ?? null)) return false;

  if (spec.deletedAtOf(row) !== null) {
    // Tombstone untuk baris yang memang tidak ada di sini: tidak ada yang dihapus, jangan dihitung.
    if (!local) return false;
    await db.runAsync(`DELETE FROM ${spec.table} WHERE ${spec.key} = ?`, [spec.keyOf(row)]);
  } else {
    await upsertRow(db, spec, row);
  }
  return true;
}

// Baris yang gagal (mis. anak datang sebelum induk di tabel yang sama) dicoba sekali lagi setelah sisanya;
// yang tetap gagal dicatat ke rejected log tanpa menghentikan pull. Jangan pernah menelan error tanpa jejak.
async function applyTable<TRow>(db: SQLiteDatabase, spec: Spec<TRow>, options: ApplyOptions): Promise<ApplyResult> {
  const result: ApplyResult = { applied: 0, rejected: 0, skipped: 0 };
  const failed: Array<{ row: TRow; error: unknown }> = [];

  for (const row of spec.rows) {
    try {
      if (await applyOne(db, spec, row)) result.applied++;
      await clearRejected(db, spec.table, spec.keyOf(row));
    } catch (error) {
      failed.push({ row, error });
    }
  }

  for (const { row, error } of failed) {
    try {
      if (await applyOne(db, spec, row)) result.applied++;
      await clearRejected(db, spec.table, spec.keyOf(row));
    } catch (retryError) {
      const finalError = retryError ?? error;
      if (isPermanentFailure(finalError, options)) {
        result.skipped++;
        await logRejected(db, spec.table, spec.keyOf(row), `dilewati: ${finalError instanceof Error ? finalError.message : finalError}`);
      } else {
        result.rejected++;
        await logRejected(db, spec.table, spec.keyOf(row), finalError);
      }
    }
  }
  return result;
}

const idSpec = <TRow extends { id: string; updatedAt: string | null; deletedAt: string | null }>(
  table: string,
  rows: TRow[],
  columns: (row: TRow) => Record<string, Value>,
  afterUpsert?: Spec<TRow>["afterUpsert"],
  beforeUpsert?: Spec<TRow>["beforeUpsert"]
): Spec<TRow> => ({
  table,
  key: "id",
  rows,
  keyOf: (row) => row.id,
  updatedAtOf: (row) => row.updatedAt,
  deletedAtOf: (row) => row.deletedAt,
  columns,
  afterUpsert,
  beforeUpsert,
});

// UNIQUE (entitas, label): pemasangan lokal dengan pasangan sama tapi id beda (dibuat di HP sebelum sync) kalah
// dari id cloud, sama seperti bentrok nama pada labels.
const junctionSpec = <TRow extends { id: string; labelId: string; updatedAt: string | null; deletedAt: string | null }>(
  table: string,
  entityColumn: string,
  rows: TRow[],
  entityIdOf: (row: TRow) => string
): Spec<TRow> =>
  idSpec(
    table,
    rows,
    (r) => ({ [entityColumn]: entityIdOf(r), label_id: r.labelId }),
    undefined,
    async (database, r) => {
      await database.runAsync(`DELETE FROM ${table} WHERE ${entityColumn} = ? AND label_id = ? AND id <> ?`, [
        entityIdOf(r),
        r.labelId,
        r.id,
      ]);
    }
  );

function add(total: ApplyResult, next: ApplyResult) {
  total.applied += next.applied;
  total.rejected += next.rejected;
  total.skipped += next.skipped;
}

// Urutan mengikuti FK: induk dulu. Pemanggil WAJIB membungkus dengan withApplyingPull supaya hasil pull
// tidak masuk antrean push (gema).
export async function applySyncResponse(
  db: SQLiteDatabase,
  response: SyncResponse,
  options: ApplyOptions
): Promise<ApplyResult> {
  const total: ApplyResult = { applied: 0, rejected: 0, skipped: 0 };
  const specs = [
    idSpec("account_groups", response.accountGroups, (r) => ({ name: r.name })),
    idSpec("categories", response.categories, (r) => ({
      name: r.name,
      icon: r.icon,
      type: r.type,
      parent_id: r.parentId,
      is_active: r.isActive ? 1 : 0,
    })),
    idSpec("contacts", response.contacts, (r) => ({ name: r.name, note: r.note })),
    idSpec(
      "labels",
      response.labels,
      (r) => ({ name: r.name, scope: r.scope }),
      undefined,
      // UNIQUE (name, scope): label lokal bernama sama tapi beda id (dibuat di HP sebelum sync) kalah dari versi cloud.
      async (database, r) => {
        await database.runAsync("DELETE FROM labels WHERE name = ? AND scope = ? AND id <> ?", [r.name, r.scope, r.id]);
      }
    ),
    idSpec("accounts", response.accounts, (r) => ({
      name: r.name,
      icon: r.icon,
      color: r.color,
      initial_balance: r.initialBalance,
      group_id: r.groupId,
      description: r.description,
      is_active: r.isActive ? 1 : 0,
      account_type: r.accountType,
    })),
  ];
  for (const spec of specs) add(total, await applyTable(db, spec as Spec<unknown>, options));

  add(total, await applyDebtAccounts(db, response.debtAccounts));

  const rest = [
    idSpec("transactions", response.transactions, (r) => ({
      type: r.type,
      amount: r.amount,
      category_id: r.categoryId,
      account_id: r.accountId,
      transfer_account_id: r.transferAccountId,
      note: r.note,
      description: r.description,
      date: r.date,
      contact_id: r.contactId,
      is_cash_neutral: r.isCashNeutral ? 1 : 0,
    })),
    idSpec("debts", response.debts, (r) => ({
      type: r.type,
      contact_id: r.contactId,
      amount: r.amount,
      account_id: r.accountId,
      transaction_id: r.transactionId,
      status: r.status,
      note: r.note,
      date: r.date,
    })),
    idSpec("debt_payments", response.debtPayments, (r) => ({
      debt_id: r.debtId,
      amount: r.amount,
      account_id: r.accountId,
      transaction_id: r.transactionId,
      note: r.note,
      date: r.date,
    })),
    {
      table: "investment_accounts",
      key: "account_id",
      rows: response.investmentAccounts,
      keyOf: (r) => r.accountId,
      updatedAtOf: (r) => r.updatedAt,
      deletedAtOf: (r) => r.deletedAt,
      columns: (r) => ({ unit_label: r.unitLabel, current_market_value: r.currentMarketValue }),
    } satisfies Spec<SyncResponse["investmentAccounts"][number]>,
    idSpec("investment_purchases", response.investmentPurchases, (r) => ({
      account_id: r.accountId,
      transaction_id: r.transactionId,
      unit: r.unit,
      price_per_unit: r.pricePerUnit,
      date: r.date,
      status: r.status,
    })),
    idSpec("investment_sales", response.investmentSales, (r) => ({
      account_id: r.accountId,
      transaction_id: r.transactionId,
      adjustment_transaction_id: r.adjustmentTransactionId,
      unit: r.unit,
      price_per_unit: r.pricePerUnit,
      average_cost_per_unit: r.averageCostPerUnit,
      realized_pl: r.realizedPl,
      date: r.date,
      status: r.status,
    })),
    {
      table: "forex_accounts",
      key: "account_id",
      rows: response.forexAccounts,
      keyOf: (r) => r.accountId,
      updatedAtOf: (r) => r.updatedAt,
      deletedAtOf: (r) => r.deletedAt,
      columns: (r) => ({ country: r.country, currency: r.currency, current_rate: r.currentRate }),
    } satisfies Spec<SyncResponse["forexAccounts"][number]>,
    idSpec("forex_purchases", response.forexPurchases, (r) => ({
      account_id: r.accountId,
      transaction_id: r.transactionId,
      unit: r.unit,
      rate: r.rate,
      date: r.date,
    })),
    idSpec("forex_sales", response.forexSales, (r) => ({
      account_id: r.accountId,
      transaction_id: r.transactionId,
      adjustment_transaction_id: r.adjustmentTransactionId,
      unit: r.unit,
      rate: r.rate,
      average_cost_per_unit: r.averageCostPerUnit,
      realized_pl: r.realizedPl,
      date: r.date,
    })),
    idSpec("third_party_funds", response.thirdPartyFunds, (r) => ({
      account_id: r.accountId,
      contact_id: r.contactId,
      transaction_id: r.transactionId,
      direction: r.direction,
      amount: r.amount,
      date: r.date,
      note: r.note,
    })),
    idSpec(
      "category_periods",
      response.categoryPeriods,
      (r) => ({ name: r.name, start_date: r.startDate, end_date: r.endDate }),
      async (database, r) => {
        // Pivot dikirim sebagai daftar category_id polos; id pivot lokal hanya penanda teknis, replace-all.
        await database.runAsync("DELETE FROM category_period_categories WHERE period_id = ?", [r.id]);
        for (const categoryId of r.categoryIds) {
          await database.runAsync(
            "INSERT INTO category_period_categories (id, period_id, category_id) VALUES (?, ?, ?)",
            [generateId(), r.id, categoryId]
          );
        }
      }
    ),
  ];
  for (const spec of rest) add(total, await applyTable(db, spec as Spec<unknown>, options));

  // Junction label paling akhir: butuh label dan entitasnya sudah ada.
  const junctions = [
    junctionSpec("transaction_labels", "transaction_id", response.transactionLabels, (r) => r.transactionId),
    junctionSpec("category_labels", "category_id", response.categoryLabels, (r) => r.categoryId),
    junctionSpec("account_labels", "account_id", response.accountLabels, (r) => r.accountId),
  ];
  for (const spec of junctions) add(total, await applyTable(db, spec as Spec<unknown>, options));

  return total;
}

// debt_accounts tidak punya updated_at lokal, jadi tidak ada LWW: dilewati kalau akunnya punya perubahan lokal
// yang belum terkirim (supaya perubahan arah di HP tidak tertimpa), dan kalau akunnya belum ada.
async function applyDebtAccounts(db: SQLiteDatabase, rows: SyncResponse["debtAccounts"]): Promise<ApplyResult> {
  const result: ApplyResult = { applied: 0, rejected: 0, skipped: 0 };
  for (const row of rows) {
    if (row.deletedAt !== null) continue;
    try {
      const pending = await db.getFirstAsync(
        "SELECT 1 FROM cloud_sync_queue WHERE table_name = 'accounts' AND row_id = ?",
        [row.accountId]
      );
      if (pending) continue;
      const account = await db.getFirstAsync("SELECT 1 FROM accounts WHERE id = ?", [row.accountId]);
      if (!account) continue;
      await db.runAsync(
        `INSERT INTO debt_accounts (account_id, direction) VALUES (?, ?)
         ON CONFLICT (account_id) DO UPDATE SET direction = excluded.direction`,
        [row.accountId, row.direction]
      );
      await clearRejected(db, "debt_accounts", row.accountId);
      result.applied++;
    } catch (error) {
      result.rejected++;
      await logRejected(db, "debt_accounts", row.accountId, error);
    }
  }
  return result;
}
