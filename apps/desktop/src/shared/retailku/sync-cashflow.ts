import { getDb } from "@/lib/db";
import type { RetailkuMcpConfig } from "./retailku-mcp-client";
import { connectRetailkuMcp, getCashflowDetail } from "./retailku-mcp-client";
import type { RetailkuCashflowSyncMode } from "./use-retailku-cashflow-sync-settings";

type Db = Awaited<ReturnType<typeof getDb>>;

export type SyncCashflowInput = {
  mcpConfig: RetailkuMcpConfig;
  /** Tanggal ISO inklusif, lihat "Pertanyaan terbuka #1". */
  dateFrom: string;
  dateTo: string;
  timezone: string;
  mode: RetailkuCashflowSyncMode;
};

export type SyncCashflowResult = {
  /** Berapa baris transaksi baru yang berhasil di-insert (tanggal/baris
   * yang sudah pernah tersinkron sebelumnya di-skip, TIDAK dihitung). */
  insertedCount: number;
  /** `accountId` Retailku yang muncul di data TAPI belum ada baris
   * `retailku_account_mapping` untuknya — di-skip, TIDAK menggagalkan
   * seluruh sync (lihat keputusan #2 revisi). */
  unmappedAccountIds: string[];
};

/**
 * Sinkronisasi cashflow Retailku -> transaksi lokal, lihat
 * docs/todos/plan/retailku-cashflow-sync.md keputusan #1 (idempotency),
 * #2 REVISI (per akun kas Retailku sendiri-sendiri, BUKAN konvergen ke
 * satu akun lokal) dan #6 (mode ringkas/detail). SUMBER DATA SEKARANG
 * SELALU `get_cashflow_detail` (punya `accountId` per baris) — TIDAK
 * LAGI memakai `get_cashflow_summary` sama sekali, bahkan untuk mode
 * ringkas, karena tool itu tidak punya breakdown per akun. SELALU
 * dibungkus BEGIN/COMMIT/ROLLBACK oleh CALLER (`sync-all.ts`).
 */
export async function syncCashflow(db: Db, input: SyncCashflowInput): Promise<SyncCashflowResult> {
  const client = await connectRetailkuMcp(input.mcpConfig);
  try {
    const rows = await fetchAllCashflowDetailRows(client, input);
    const accountMap = await loadAccountMapping(db);

    const totals =
      input.mode === "summary"
        ? aggregateByDateAndAccount(rows)
        : aggregateByDateAccountAndSourceType(rows);

    let insertedCount = 0;
    const unmappedAccountIds = new Set<string>();

    for (const total of totals) {
      if (total.net === 0) continue;

      const localAccountId = accountMap.get(total.retailkuAccountId);
      if (localAccountId == null) {
        unmappedAccountIds.add(total.retailkuAccountId);
        continue;
      }

      const alreadySynced = await isSourceRefSynced(db, total.sourceRef);
      if (alreadySynced) continue;

      await insertCashflowTransaction(db, {
        accountId: localAccountId,
        amount: total.net,
        date: total.date,
        note: total.note,
        sourceRef: total.sourceRef,
      });
      insertedCount += 1;
    }

    return { insertedCount, unmappedAccountIds: [...unmappedAccountIds] };
  } finally {
    await client.close();
  }
}

async function fetchAllCashflowDetailRows(
  client: Awaited<ReturnType<typeof connectRetailkuMcp>>,
  input: Pick<SyncCashflowInput, "dateFrom" | "dateTo" | "timezone">
) {
  const rows: Awaited<ReturnType<typeof getCashflowDetail>>["data"] = [];
  let page = 1;
  const limit = 100;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await getCashflowDetail(client, {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      timezone: input.timezone,
      page,
      limit,
    });
    rows.push(...result.data);
    if (page >= result.meta.pagination.totalPages) break;
    page += 1;
  }
  return rows;
}

async function loadAccountMapping(db: Db): Promise<Map<string, number>> {
  const rows = await db.select<{ retailku_account_id: string; local_account_id: number }[]>(
    "SELECT retailku_account_id, local_account_id FROM retailku_account_mapping"
  );
  return new Map(rows.map((row) => [row.retailku_account_id, row.local_account_id]));
}

type AggregatedTotal = {
  date: string;
  retailkuAccountId: string;
  net: number;
  note: string;
  sourceRef: string;
};

function aggregateByDateAndAccount(
  rows: Awaited<ReturnType<typeof getCashflowDetail>>["data"]
): AggregatedTotal[] {
  const totals = new Map<string, AggregatedTotal>();
  for (const row of rows) {
    const date = row.date.slice(0, 10);
    const key = `${date}:${row.accountId}`;
    const existing = totals.get(key);
    const net = row.debit - row.credit;
    totals.set(key, {
      date,
      retailkuAccountId: row.accountId,
      net: (existing?.net ?? 0) + net,
      note: `Ringkasan Kas Harian Retailku — ${row.accountName}`,
      sourceRef: key,
    });
  }
  return [...totals.values()];
}

function aggregateByDateAccountAndSourceType(
  rows: Awaited<ReturnType<typeof getCashflowDetail>>["data"]
): AggregatedTotal[] {
  const totals = new Map<string, AggregatedTotal & { accountName: string; sourceType: string }>();
  for (const row of rows) {
    const date = row.date.slice(0, 10);
    const sourceType = row.sourceType ?? "LAINNYA";
    const key = `${date}:${row.accountId}:${sourceType}`;
    const existing = totals.get(key);
    const net = row.debit - row.credit;
    totals.set(key, {
      date,
      retailkuAccountId: row.accountId,
      accountName: row.accountName,
      sourceType,
      net: (existing?.net ?? 0) + net,
      note: `Kas Harian Retailku — ${row.accountName} — ${sourceType}`,
      sourceRef: key,
    });
  }
  return [...totals.values()];
}

async function isSourceRefSynced(db: Db, sourceRef: string): Promise<boolean> {
  const rows = await db.select<{ found: number }[]>(
    "SELECT 1 AS found FROM transactions WHERE source = 'retailku_sync' AND source_ref = $1 LIMIT 1",
    [sourceRef]
  );
  return rows.length > 0;
}

async function insertCashflowTransaction(
  db: Db,
  params: { accountId: number; amount: number; date: string; note: string; sourceRef: string }
): Promise<void> {
  const type = params.amount >= 0 ? "income" : "expense";
  await db.execute(
    `INSERT INTO transactions (type, amount, account_id, note, date, source, source_ref)
     VALUES ($1, $2, $3, $4, $5, 'retailku_sync', $6)`,
    [type, Math.abs(params.amount), params.accountId, params.note, params.date, params.sourceRef]
  );
}
